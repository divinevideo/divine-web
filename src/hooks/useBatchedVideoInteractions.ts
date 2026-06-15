// ABOUTME: Batched hook for fetching user interactions with multiple videos at once
// ABOUTME: Solves N+1 query problem when viewing video feeds with many videos

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { SHORT_VIDEO_KIND, UserInteractions } from '@/types/video';
import { debugLog } from '@/lib/debug';

export interface BatchedVideoInteractionsResult {
  interactions: Map<string, UserInteractions>;
  isLoading: boolean;
}

/**
 * Fetch user interactions for multiple videos in a single batched query
 * Much more efficient than calling useVideoUserInteractions for each video
 *
 * @param videos - Array of videos with id, pubkey, and vineId
 * @param userPubkey - The current user's pubkey
 */
export function useBatchedVideoInteractions(
  videos: Array<{ id: string; pubkey: string; vineId: string | null }>,
  userPubkey?: string
): BatchedVideoInteractionsResult {
  const { nostr } = useNostr();

  // Create stable query key from video IDs
  const videoIds = videos.map(v => v.id).sort().join(',');

  const query = useQuery({
    queryKey: ['batched-video-interactions', videoIds, userPubkey],
    enabled: !!userPubkey && videos.length > 0,
    queryFn: async (context) => {
      if (!userPubkey || videos.length === 0) {
        return new Map<string, UserInteractions>();
      }

      debugLog(`[useBatchedVideoInteractions] Fetching interactions for ${videos.length} videos`);

      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(10000)]);
      const interactions = new Map<string, UserInteractions>();

      // Initialize all videos with default interactions
      for (const video of videos) {
        interactions.set(video.id, {
          hasLiked: false,
          hasReposted: false,
          likeEventId: null,
          repostEventId: null,
        });
      }

      try {
        // Build addressable IDs for all videos
        const addressableIds = videos
          .filter(v => v.vineId)
          .map(v => `${SHORT_VIDEO_KIND}:${v.pubkey}:${v.vineId}`);

        const videoIdList = videos.map(v => v.id);

        // Single batched query for all reactions and reposts
        const events = await nostr.query([
          {
            kinds: [7], // reactions
            authors: [userPubkey],
            '#e': videoIdList,
            limit: videos.length * 2, // Allow for multiple reactions per video
          },
          ...(addressableIds.length > 0 ? [{
            kinds: [16, 7], // generic reposts
            authors: [userPubkey],
            '#a': addressableIds,
            limit: videos.length * 2,
          }] : []),
        ], { signal });

        if (events.length === 0) {
          debugLog(`[useBatchedVideoInteractions] No interactions found`);
          return interactions;
        }

        // Get all event IDs to check for deletions
        const eventIdsToCheck = events.map(e => e.id);

        // Single query for all delete events
        const deleteEvents = await nostr.query([
          {
            kinds: [5], // Delete events (NIP-09)
            authors: [userPubkey],
            '#e': eventIdsToCheck,
            limit: eventIdsToCheck.length,
          }
        ], { signal });

        // Build set of deleted event IDs
        const deletedEventIds = new Set<string>();
        for (const deleteEvent of deleteEvents) {
          for (const tag of deleteEvent.tags) {
            if (tag[0] === 'e' && tag[1]) {
              deletedEventIds.add(tag[1]);
            }
          }
        }

        // Process events, mapping them to videos
        for (const event of events) {
          if (deletedEventIds.has(event.id)) continue;

          // Find which video this event relates to
          let videoId: string | null = null;

          // Check #e tags for direct video reference
          for (const tag of event.tags) {
            if (tag[0] === 'e' && videoIdList.includes(tag[1])) {
              videoId = tag[1];
              break;
            }
            // Check #a tags for addressable event reference
            if (tag[0] === 'a') {
              const video = videos.find(v =>
                v.vineId && `${SHORT_VIDEO_KIND}:${v.pubkey}:${v.vineId}` === tag[1]
              );
              if (video) {
                videoId = video.id;
                break;
              }
            }
          }

          if (!videoId) continue;

          const current = interactions.get(videoId);
          if (!current) continue;

          if (event.kind === 7 && (event.content === '+' || event.content === '❤️' || event.content === '👍')) {
            current.hasLiked = true;
            current.likeEventId = event.id;
          }
          if (event.kind === 16) {
            current.hasReposted = true;
            current.repostEventId = event.id;
          }

          interactions.set(videoId, current);
        }

        debugLog(`[useBatchedVideoInteractions] Found interactions for ${events.length} events`);
        return interactions;
      } catch (error) {
        console.error('[useBatchedVideoInteractions] Failed to fetch interactions:', error);
        return interactions;
      }
    },
    staleTime: 30000, // 30 seconds
    gcTime: 300000,   // 5 minutes
  });

  return {
    interactions: query.data ?? new Map(),
    isLoading: query.isLoading,
  };
}
