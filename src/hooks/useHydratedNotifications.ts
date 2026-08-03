// ABOUTME: Hydrated notifications hook — groups raw notifications and enriches with profile and video metadata
// ABOUTME: Delegates paging to useNotifications; profile fetching to useBatchedAuthors; video fetching via internal query

import { useMemo } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_CONFIG } from '@/config/api';
import { fetchBulkVideos, fetchVideoById } from '@/lib/funnelcakeClient';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { genUserName } from '@/lib/genUserName';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { groupRawNotifications, type NotificationVideoMeta } from '@/lib/notificationGrouping';
import { useNotifications } from '@/hooks/useNotifications';
import { useBatchedAuthors } from '@/hooks/useBatchedAuthors';
import type { ActorInfo, NotificationFilters, NotificationItem, RawNotification } from '@/types/notification';

export interface HydratedNotificationsResult {
  items: NotificationItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  unreadCount: number;
}

/**
 * Hydrates raw notifications with profile metadata and video metadata,
 * then groups them into the VideoNotification | ActorNotification UI union.
 *
 * - Profile data comes from useBatchedAuthors (REST-first, WebSocket fallback).
 * - Video data is bulk-fetched via fetchBulkVideos (REST), seeding the
 *   per-video cache; uncached/missing videos fall back to fetchVideoById.
 * - For category === 'unread', each raw notification is grouped individually
 *   to preserve one-per-raw behaviour while reusing the same rendering path.
 */
export function useHydratedNotifications(
  filters: NotificationFilters,
): HydratedNotificationsResult {
  const apiUrl = API_CONFIG.funnelcake.baseUrl;
  const queryClient = useQueryClient();

  // -------------------------------------------------------------------------
  // Raw notifications (paginated)
  // -------------------------------------------------------------------------
  const notificationsQuery = useNotifications(filters);

  const flatRaw: RawNotification[] = useMemo(
    () =>
      (notificationsQuery.data?.pages ?? []).flatMap((page) => page.notifications),
    [notificationsQuery.data?.pages],
  );

  const unreadCount = notificationsQuery.data?.pages[0]?.unreadCount ?? 0;

  // -------------------------------------------------------------------------
  // Profile hydration
  // -------------------------------------------------------------------------
  // The notifications response embeds `source_profile`, so only actors it did
  // not describe need a profile lookup.
  const embeddedProfiles = useMemo(() => {
    const map = new Map<string, ActorInfo>();
    for (const row of flatRaw) {
      const embedded = row.actorProfile;
      if (!embedded?.displayName || map.has(row.actorPubkey)) continue;
      map.set(row.actorPubkey, {
        pubkey: row.actorPubkey,
        displayName: embedded.displayName,
        avatarUrl: getSafeProfileImage(embedded.avatarUrl),
        nip05: embedded.nip05,
      });
    }
    return map;
  }, [flatRaw]);

  const actorPubkeys = useMemo(
    () =>
      Array.from(new Set(flatRaw.map((r) => r.actorPubkey))).filter(
        (pubkey) => !embeddedProfiles.has(pubkey),
      ),
    [flatRaw, embeddedProfiles],
  );
  const authorsQuery = useBatchedAuthors(actorPubkeys);

  const profiles = useMemo(() => {
    const fetched = buildProfilesMap(actorPubkeys, authorsQuery.data ?? {});
    return new Map([...embeddedProfiles, ...fetched]);
  }, [actorPubkeys, authorsQuery.data, embeddedProfiles]);

  // -------------------------------------------------------------------------
  // Video hydration (internal — not exported)
  // -------------------------------------------------------------------------
  // Likewise for `referenced_video` / `referenced_event_title`: rows that
  // arrived with their own metadata do not need a video request.
  const embeddedVideos = useMemo(() => {
    const map = new Map<string, NotificationVideoMeta>();
    for (const row of flatRaw) {
      if (!row.targetEventId || !row.videoMeta) continue;
      // Two rows about one video can each carry a different half of its
      // metadata (a title from `referenced_event_title`, a thumbnail from
      // `referenced_video`), so fill gaps instead of letting the first row win.
      const existing = map.get(row.targetEventId);
      map.set(row.targetEventId, {
        title: existing?.title ?? row.videoMeta.title,
        thumbnailUrl: existing?.thumbnailUrl ?? row.videoMeta.thumbnailUrl,
      });
    }
    return map;
  }, [flatRaw]);

  const sortedIds = useMemo(() => {
    const ids = Array.from(
      new Set(
        flatRaw
          .filter((r) => r.type !== 'follow' && r.targetEventId)
          .map((r) => r.targetEventId as string),
      ),
      // Only a row carrying BOTH fields is fully hydrated. Treating any
      // embedded metadata as complete meant a title-only response permanently
      // suppressed the thumbnail fetch.
    ).filter((id) => !isCompleteVideoMeta(embeddedVideos.get(id)));
    return ids.sort();
  }, [flatRaw, embeddedVideos]);

  const videosQuery = useQuery({
    queryKey: ['notification-videos', sortedIds],
    queryFn: async ({ signal }) => {
      // Bulk-fetch all needed videos in one request, seeding the per-video
      // cache so downstream consumers still hit ['notification-video', id].
      if (isFunnelcakeAvailable(apiUrl)) {
        try {
          const { videos } = await fetchBulkVideos(apiUrl, sortedIds, signal);
          for (const video of videos) {
            queryClient.setQueryData<NotificationVideoMeta>(
              ['notification-video', video.id],
              {
                title: video.title || undefined,
                thumbnailUrl: video.thumbnail || undefined,
              },
            );
          }
        } catch {
          // Bulk failed — fall through to the per-video path below.
        }
      }

      const entries = await Promise.all(
        sortedIds.map(async (id) => {
          try {
            const result = await queryClient.ensureQueryData<NotificationVideoMeta>({
              queryKey: ['notification-video', id],
              queryFn: async ({ signal }) => {
                const video = await fetchVideoById(apiUrl, id, undefined, signal);
                if (signal.aborted || !video) {
                  throw new Error('Video metadata unavailable');
                }
                return {
                  title: video.title,
                  thumbnailUrl: video.thumbnail,
                };
              },
              staleTime: 10 * 60 * 1000,
            });
            return [id, result] as const;
          } catch {
            return [id, {} as NotificationVideoMeta] as const;
          }
        }),
      );

      return Object.fromEntries(entries);
    },
    enabled: sortedIds.length > 0,
    // The key carries the id set, so every new page mints a new key and the
    // previous result would otherwise blank to undefined mid-flight - dropping
    // every already-hydrated row to "your video" and the placeholder thumbnail
    // on each scroll. Keep the last result visible while the new one loads.
    placeholderData: keepPreviousData,
    // Matches the per-video entries this query seeds. The key already carries
    // the id set, so a new target still fetches; staleTime 0 only bought a
    // repeat bulk POST every time the page remounted with the same ids.
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const videosMap: Map<string, NotificationVideoMeta> = useMemo(() => {
    const merged = new Map(embeddedVideos);
    for (const [id, fetched] of Object.entries(videosQuery.data ?? {})) {
      // A fetch that resolved only one field must not blank out the other one
      // the response already gave us.
      const embedded = merged.get(id);
      merged.set(id, {
        title: fetched.title ?? embedded?.title,
        thumbnailUrl: fetched.thumbnailUrl ?? embedded?.thumbnailUrl,
      });
    }
    return merged;
  }, [embeddedVideos, videosQuery.data]);

  // -------------------------------------------------------------------------
  // Grouping
  // -------------------------------------------------------------------------
  const items = useMemo(
    () =>
      filters.category === 'unread'
        ? flatRaw.flatMap((r) => groupRawNotifications([r], profiles, videosMap))
        : groupRawNotifications(flatRaw, profiles, videosMap),
    [flatRaw, profiles, videosMap, filters.category],
  );

  // -------------------------------------------------------------------------
  // Result
  // -------------------------------------------------------------------------
  return {
    items,
    isLoading: notificationsQuery.isLoading,
    isError: notificationsQuery.isError,
    error: notificationsQuery.error,
    fetchNextPage: notificationsQuery.fetchNextPage,
    hasNextPage: notificationsQuery.hasNextPage ?? false,
    isFetchingNextPage: notificationsQuery.isFetchingNextPage,
    unreadCount,
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** A row needs no video request only when the response supplied both fields. */
function isCompleteVideoMeta(meta: NotificationVideoMeta | undefined): boolean {
  return Boolean(meta?.title && meta?.thumbnailUrl);
}

function buildProfilesMap(
  pubkeys: string[],
  authorsData: Record<string, { metadata?: import('@nostrify/nostrify').NostrMetadata }>,
): Map<string, ActorInfo> {
  const map = new Map<string, ActorInfo>();

  for (const pubkey of pubkeys) {
    const author = authorsData[pubkey];
    const metadata = author?.metadata;

    const displayName =
      metadata?.display_name || metadata?.name || genUserName(pubkey);

    map.set(pubkey, {
      pubkey,
      displayName,
      avatarUrl: getSafeProfileImage(metadata?.picture),
      nip05: metadata?.nip05,
    });
  }

  return map;
}
