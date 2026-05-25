// ABOUTME: Hook for managing NIP-51 kind 10003 global bookmarks
// ABOUTME: Handles bookmark events that store video IDs in 'e' tags

import { useNostr } from '@nostrify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { VIDEO_KINDS, type ParsedVideoData } from '@/types/video';
import { parseVideoEvents } from '@/lib/videoParser';

const BOOKMARK_KIND = 10003;

/**
 * Extract video event IDs from 'e' tags in a bookmark event
 */
function extractVideoIds(event: NostrEvent): string[] {
  return event.tags
    .filter(tag => tag[0] === 'e' && tag[1])
    .map(tag => tag[1]);
}

/**
 * Hook to fetch bookmarked video IDs for a user
 * Fetches NIP-51 kind 10003 events and extracts 'e' tags
 */
export function useBookmarkedVideoIds(pubkey?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const targetPubkey = pubkey || user?.pubkey;

  return useQuery({
    queryKey: ['bookmarked-video-ids', targetPubkey],
    queryFn: async (context) => {
      if (!targetPubkey) return [];

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(5000)
      ]);

      const filter: NostrFilter = {
        kinds: [BOOKMARK_KIND],
        authors: [targetPubkey],
        limit: 1
      };

      const events = await nostr.query([filter], { signal });

      if (events.length === 0) return [];

      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
      return extractVideoIds(latestEvent);
    },
    enabled: !!targetPubkey || !pubkey,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
}

/**
 * Hook to toggle bookmark status for a video
 * If video is bookmarked → remove it, if not bookmarked → add it
 */
export function useBookmarkVideo() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ videoId }: { videoId: string }) => {
      if (!user) throw new Error('Must be logged in to bookmark videos');

      // Fetch current bookmark event
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([{
        kinds: [BOOKMARK_KIND],
        authors: [user.pubkey],
        limit: 1
      }], { signal });

      // Extract current video IDs
      const currentVideoIds = events.length > 0
        ? extractVideoIds(events[0])
        : [];

      // Check if video is already bookmarked
      const isBookmarked = currentVideoIds.includes(videoId);

      // Build new tag list
      const tags: string[][] = [];

      if (isBookmarked) {
        // Remove the e tag - filter out all e tags and add back except the one being removed
        const filteredVideoIds = currentVideoIds.filter(id => id !== videoId);
        filteredVideoIds.forEach(id => {
          tags.push(['e', id]);
        });
      } else {
        // Add the e tag - keep existing and append new one
        currentVideoIds.forEach(id => {
          tags.push(['e', id]);
        });
        tags.push(['e', videoId]);
      }

      // Publish updated bookmark event (kind 10003 is replaceable)
      await publishEvent({
        kind: BOOKMARK_KIND,
        content: 'Divine global bookmarks',
        tags
      });

      return { videoId, isBookmarked };
    },
    onSuccess: () => {
      // Invalidate bookmark queries
      queryClient.invalidateQueries({ queryKey: ['bookmarked-video-ids'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarked-videos'] });
    }
  });
}

/**
 * Hook to fetch full ParsedVideoData for all bookmarked videos
 * Uses useBookmarkedVideoIds to get IDs, then batch-fetches video events
 */
export function useBookmarkedVideos(pubkey?: string, limit = 50) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const targetPubkey = pubkey || user?.pubkey;

  // First get the bookmarked video IDs
  const { data: videoIds, isLoading: isIdsLoading } = useBookmarkedVideoIds(targetPubkey);

  return useQuery({
    queryKey: ['bookmarked-videos', targetPubkey, videoIds?.slice(0, limit)],
    queryFn: async (context) => {
      if (!videoIds || videoIds.length === 0) {
        return { videos: [], nextCursor: undefined };
      }

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(10000)
      ]);

      // Query the video events - slice to respect limit
      const idsToFetch = videoIds.slice(0, limit);
      
      // For Kind 2 videos, we need to fetch by event ID
      // Note: Bookmarks store the event ID of the video
      const events = await nostr.query([{
        kinds: VIDEO_KINDS,
        ids: idsToFetch,
        limit: idsToFetch.length
      }], { signal });

      // Parse video events (this also handles reposts)
      const parsedVideos: ParsedVideoData[] = parseVideoEvents(events);

      // Determine next cursor
      const hasMore = videoIds.length > limit;
      const nextCursor = hasMore ? videoIds[limit] : undefined;

      return { videos: parsedVideos, nextCursor };
    },
    enabled: !!targetPubkey && !isIdsLoading && (!!videoIds && videoIds.length > 0),
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
}
