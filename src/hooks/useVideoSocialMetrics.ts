// ABOUTME: Hook for fetching video social interaction metrics (likes, reposts, views)
// ABOUTME: Provides efficient batched queries to minimize relay requests

import { UserInteractions, SHORT_VIDEO_KIND } from '@/types/video';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NIP50Filter } from '@/types/nostr';

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
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['video-social-metrics', videoId, videoPubkey, vineId],
    enabled: options?.enabled !== false,
    queryFn: async (context) => {
      // 10s timeout to accommodate gateway REST API
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(10000)]);

      try {
        // For kind 34236 (addressable videos), we need to query by both #e and #a tags
        // - #e tag: Used by likes (kind 7) and zap receipts (kind 9735) - backward compatibility
        // - #A tag: Used by comments (kind 1111) - uppercase A to get all comments including replies
        // - #a tag: Used by generic reposts (kind 16) and likes (kind 7) for addressable events
        const addressableId = `${SHORT_VIDEO_KIND}:${videoPubkey}:${vineId ?? ''}`;
        const filters: NIP50Filter[] = [
          {
            kinds: [7, 9735], // reactions (backward compatibility), zap receipts
            '#e': [videoId], // Standard event references
            limit: 500,
          } as NIP50Filter & { '#e': string[] },
          {
            kinds: [1111],
            '#A': [addressableId],
            limit: 500,
          } as NIP50Filter & { '#A': string[] },
          {
            kinds: [16, 7], // generic reposts and reactions for addressable events
            '#a': [addressableId],
            limit: 500,
          } as NIP50Filter & { '#a': string[] },
        ];



        const events = await nostr.query(filters, { signal });

        // Use Sets to deduplicate by event ID
        const likeEventIds = new Set<string>();
        const repostEventIds = new Set<string>();
        let viewCount = 0;
        let commentCount = 0;
        const likes: VideoReaction[] = [];
        const reposts: VideoReaction[] = [];

        // Process each event type
        for (const event of events) {
          switch (event.kind) {
            case 7: // Reaction events (likes)
              // Check if it's a positive reaction (like) and not already counted
              if ((event.content === '+' || event.content === '❤️' || event.content === '👍') && !likeEventIds.has(event.id)) {
                likeEventIds.add(event.id);
                likes.push({
                  pubkey: event.pubkey,
                  eventId: event.id,
                  timestamp: event.created_at,
                  type: 'like',
                });
              }
              break;

            case 16: // Generic repost events
              if (!repostEventIds.has(event.id)) {
                repostEventIds.add(event.id);
                reposts.push({
                  pubkey: event.pubkey,
                  eventId: event.id,
                  timestamp: event.created_at,
                  type: 'repost',
                });
              }
              break;

            case 1: // Text note comments (legacy, shouldn't appear but count if found)
            case 1111: // NIP-22 comments (includes all comments: top-level and replies)
              commentCount++;
              break;

            case 9735: // Zap receipts (using as view indicator)
              // For now, count zap receipts as views
              // In a more sophisticated implementation, we might have dedicated view events
              viewCount++;
              break;
          }
        }

        // Sort by timestamp (newest first)
        likes.sort((a, b) => b.timestamp - a.timestamp);
        reposts.sort((a, b) => b.timestamp - a.timestamp);

        // For view count, we could also implement a custom approach
        // For now, we'll use zap receipts as a proxy, but this could be enhanced
        // with dedicated kind 34236 view events or other mechanisms

        const metrics: VideoSocialMetrics = {
          likeCount: likes.length,
          repostCount: reposts.length,
          viewCount,
          commentCount,
          likes,
          reposts,
        };

        return metrics;
      } catch (error) {
        console.error('Failed to fetch video social metrics:', error);
        // Return default values on error
        return {
          likeCount: 0,
          repostCount: 0,
          viewCount: 0,
          commentCount: 0,
          likes: [],
          reposts: [],
        } as VideoSocialMetrics;
      }
    },
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

      // 10s timeout to accommodate gateway REST API
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(10000)]);

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