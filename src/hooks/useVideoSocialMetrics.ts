// ABOUTME: Hook for fetching video social interaction metrics (likes, reposts, views)
// ABOUTME: Returns zeros for metrics (Funnelcake provides counts); WebSocket still used for user interactions

import { UserInteractions, SHORT_VIDEO_KIND } from '@/types/video';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

export interface VideoReaction {
  pubkey: string;
  eventId: string;
  timestamp: number;
  type: 'like' | 'repost';
}

export interface VideoSocialMetrics {
  likeCount: number;
  repostCount: number;
  viewCount: number;
  commentCount: number;
  // Reaction data for showing who liked/reposted
  likes: VideoReaction[];
  reposts: VideoReaction[];
}

/**
 * Fetch social interaction metrics for a video event
 * Uses batched queries to efficiently fetch likes, reposts, and views
 *
 * @param videoId - The video event ID
 * @param videoPubkey - The video author's pubkey (required for addressable events)
 * @param vineId - The video's vineId (d tag) for addressable events
 * @param options - Optional query options
 */
export function useVideoSocialMetrics(
  videoId: string,
  videoPubkey: string,
  vineId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['video-social-metrics', videoId, videoPubkey, vineId],
    enabled: options?.enabled !== false,
    // Return zeros - Funnelcake already provides counts via video.likeCount etc.
    // VideoFeed adds: video.likeCount + socialMetrics.likeCount = correct total
    // Optimistic updates still work by incrementing this cache
    queryFn: async () => ({
      likeCount: 0,
      repostCount: 0,
      viewCount: 0,
      commentCount: 0,
      likes: [],
      reposts: [],
    }),
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    retry: 2,
  });
}

/**
 * Check if the current user has liked a specific video and get the event IDs for deletion
 */
export function useVideoUserInteractions(
  videoId: string,
  videoPubkey: string,
  vineId: string | null,
  userPubkey?: string,
  options?: { enabled?: boolean }
) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['video-user-interactions', videoId, userPubkey],
    enabled: (options?.enabled !== false) && !!userPubkey,
    queryFn: async (context) => {
      if (!userPubkey) {
        return { hasLiked: false, hasReposted: false, likeEventId: null, repostEventId: null };
      }

      // 5s timeout - user interactions are important but shouldn't block UI
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(5000)]);

      try {
        const addressableId = `${SHORT_VIDEO_KIND}:${videoPubkey}:${vineId ?? ''}`;
        // Query for user's interactions with this video
        const events = await nostr.query([ 
          {
            kinds: [7], // reactions (backward)
            authors: [userPubkey],
            '#e': [videoId],
            limit: 10,
          },
          {
            kinds: [16, 7], // generic reposts
            authors: [userPubkey],
            '#a': [addressableId],
            limit: 10,
          }
        ], { signal });

        const userInteractions: UserInteractions = {
          hasLiked: false,
          hasReposted: false,
          likeEventId: null,
          repostEventId: null
        };

        // Filter out deleted events by checking for delete events (kind 5)
        const deleteEvents = await nostr.query([
          {
            kinds: [5], // Delete events (NIP-09)
            authors: [userPubkey],
            '#e': events.map(e => e.id), // Check if any of our events are deleted
            limit: 20,
          }
        ], { signal });

        const deletedEventIds = new Set();
        deleteEvents.forEach(deleteEvent => {
          deleteEvent.tags.forEach(tag => {
            if (tag[0] === 'e' && tag[1]) {
              deletedEventIds.add(tag[1]);
            }
          });
        });

        // Process events, ignoring deleted ones
        for (const event of events) {
          if (deletedEventIds.has(event.id)) continue; // Skip deleted events

          if (event.kind === 7 && (event.content === '+' || event.content === '❤️' || event.content === '👍')) {
            userInteractions.hasLiked = true;
            userInteractions.likeEventId = event.id;
          }
          if (event.kind === 16) {
            userInteractions.hasReposted = true;
            userInteractions.repostEventId = event.id;
          }
        }

        return userInteractions;
      } catch (error) {
        console.error('Failed to fetch user video interactions:', error);
        return { hasLiked: false, hasReposted: false, likeEventId: null, repostEventId: null };
      }
    },
    staleTime: 30000, // Consider data stale after 30 seconds (faster refresh for interactive features)
    gcTime: 300000, // Keep in cache for 5 minutes
  });
}