// ABOUTME: Hooks for managing pinned videos on user profiles using NIP-51 pin lists (kind 10001)
// ABOUTME: Provides read/write access to a user's pinned video list with max 3 pins

import { useNostr } from '@nostrify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND } from '@/types/video';

export const PIN_LIST_KIND = 10001;
export const MAX_PINNED_VIDEOS = 3;

/**
 * Parse video coordinates from a pin list event.
 * Only returns `a` tags that reference kind 34236 (short-form video) events.
 * Other pin types (e.g., `e` tags for note pins from other Nostr apps) are ignored.
 */
function parseVideoCoordinates(event: NostrEvent): string[] {
  return event.tags
    .filter(tag => tag[0] === 'a' && tag[1]?.startsWith(`${SHORT_VIDEO_KIND}:`))
    .map(tag => tag[1]);
}

/**
 * Fetch a user's pinned video coordinates (kind 10001 `a` tags).
 */
export function usePinnedVideos(pubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['pinned-videos', pubkey],
    queryFn: async (context) => {
      if (!pubkey) return [];

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(5000),
      ]);

      const filter: NostrFilter = {
        kinds: [PIN_LIST_KIND],
        authors: [pubkey],
        limit: 1,
      };

      const events = await nostr.query([filter], { signal });
      if (events.length === 0) return [];

      const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
      return parseVideoCoordinates(latest);
    },
    enabled: !!pubkey,
    staleTime: 60000,
    gcTime: 300000,
  });
}

/**
 * Pin a video to the current user's profile.
 * Validates max count and deduplication before publishing.
 */
export function usePinVideo() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ coordinate }: { coordinate: string }) => {
      if (!user) throw new Error('Must be logged in to pin videos');

      // Fetch current pin list
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([{
        kinds: [PIN_LIST_KIND],
        authors: [user.pubkey],
        limit: 1,
      }], { signal });

      // Preserve all existing tags (including non-video pins from other apps)
      const existingTags: string[][] = events.length > 0
        ? events.sort((a, b) => b.created_at - a.created_at)[0].tags
        : [];

      // Extract only video coordinates for validation
      const videoCoords = existingTags
        .filter(tag => tag[0] === 'a' && tag[1]?.startsWith(`${SHORT_VIDEO_KIND}:`))
        .map(tag => tag[1]);

      // Check for duplicate
      if (videoCoords.includes(coordinate)) {
        return; // Already pinned
      }

      // Check max limit
      if (videoCoords.length >= MAX_PINNED_VIDEOS) {
        throw new Error(`You can pin up to ${MAX_PINNED_VIDEOS} videos`);
      }

      // Rebuild: keep all existing tags + add new pin
      const tags: string[][] = [...existingTags, ['a', coordinate]];

      await publishEvent({
        kind: PIN_LIST_KIND,
        content: '',
        tags,
      });
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['pinned-videos', user.pubkey] });
      }
    },
  });
}

/**
 * Unpin a video from the current user's profile.
 */
export function useUnpinVideo() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ coordinate }: { coordinate: string }) => {
      if (!user) throw new Error('Must be logged in to unpin videos');

      // Fetch current pin list
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([{
        kinds: [PIN_LIST_KIND],
        authors: [user.pubkey],
        limit: 1,
      }], { signal });

      if (events.length === 0) return;

      const latest = events.sort((a, b) => b.created_at - a.created_at)[0];

      // Remove the specific coordinate tag, preserve everything else
      const tags = latest.tags.filter(
        tag => !(tag[0] === 'a' && tag[1] === coordinate)
      );

      await publishEvent({
        kind: PIN_LIST_KIND,
        content: '',
        tags,
      });
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['pinned-videos', user.pubkey] });
      }
    },
  });
}

/**
 * Check if a video coordinate is in the current user's pin list.
 */
export function useIsVideoPinned(coordinate?: string) {
  const { user } = useCurrentUser();
  const { data: pinnedCoords = [] } = usePinnedVideos(user?.pubkey);

  if (!coordinate || !user) return false;
  return pinnedCoords.includes(coordinate);
}
