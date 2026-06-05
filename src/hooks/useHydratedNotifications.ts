// ABOUTME: Hydrated notifications hook — groups raw notifications and enriches with profile and video metadata
// ABOUTME: Delegates paging to useNotifications; profile fetching to useBatchedAuthors; video fetching via internal query

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_CONFIG } from '@/config/api';
import { fetchVideoById } from '@/lib/funnelcakeClient';
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
  error: unknown;
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
 * - Video data is fetched internally per-id via fetchVideoById and cached.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notificationsQuery.data?.pages],
  );

  const unreadCount = notificationsQuery.data?.pages[0]?.unreadCount ?? 0;

  // -------------------------------------------------------------------------
  // Profile hydration
  // -------------------------------------------------------------------------
  const actorPubkeys = useMemo(
    () => Array.from(new Set(flatRaw.map((r) => r.actorPubkey))),
    [flatRaw],
  );
  const authorsQuery = useBatchedAuthors(actorPubkeys);

  const profiles = useMemo(
    () => buildProfilesMap(actorPubkeys, authorsQuery.data ?? {}),
    [actorPubkeys, authorsQuery.data],
  );

  // -------------------------------------------------------------------------
  // Video hydration (internal — not exported)
  // -------------------------------------------------------------------------
  const sortedIds = useMemo(() => {
    const ids = Array.from(
      new Set(
        flatRaw
          .filter((r) => r.type !== 'follow' && r.targetEventId)
          .map((r) => r.targetEventId as string),
      ),
    );
    return ids.sort();
  }, [flatRaw]);

  const videosQuery = useQuery({
    queryKey: ['notification-videos', sortedIds.join(',')],
    queryFn: async ({ signal }) => {
      const entries = await Promise.all(
        sortedIds.map(async (id) => {
          try {
            const result = await queryClient.ensureQueryData<NotificationVideoMeta>({
              queryKey: ['notification-video', id],
              queryFn: async () => {
                const video = await fetchVideoById(apiUrl, id, undefined, signal);
                if (!video) return {};
                return {
                  title: video.title,
                  thumbnailUrl: video.thumbnail,
                };
              },
              staleTime: 10 * 60 * 1000,
            });
            return [id, result] as const;
          } catch {
            // Per-video failure stored as empty object — row still shown
            return [id, {} as NotificationVideoMeta] as const;
          }
        }),
      );

      return Object.fromEntries(entries);
    },
    enabled: sortedIds.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const videosMap: Map<string, NotificationVideoMeta> = useMemo(
    () => new Map(Object.entries(videosQuery.data ?? {})),
    [videosQuery.data],
  );

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
