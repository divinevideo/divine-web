// ABOUTME: Hook for fetching video statistics in bulk from Funnelcake REST API
// ABOUTME: Efficiently fetches stats for multiple videos in a single request

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { API_CONFIG } from '@/config/api';
import { fetchBulkVideoStats } from '@/lib/funnelcakeClient';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { debugLog } from '@/lib/debug';

interface VideoStats {
  id: string;
  reactions: number;
  comments: number;
  reposts: number;
  loops?: number;
  engagementScore?: number;
  trendingScore?: number;
}

/**
 * Hook for fetching bulk video statistics
 * Automatically populates individual video stat caches
 */
export function useBulkVideoStats(eventIds: string[]) {
  const queryClient = useQueryClient();
  const apiUrl = API_CONFIG.funnelcake.baseUrl;

  // Get unique event IDs
  const uniqueIds = Array.from(new Set(eventIds.filter(Boolean)));

  const query = useQuery({
    queryKey: ['bulk-video-stats', uniqueIds.sort().join(',')],
    queryFn: async ({ signal }) => {
      if (uniqueIds.length === 0) {
        return { stats: {}, missing: [] };
      }

      if (!isFunnelcakeAvailable(apiUrl)) {
        throw new Error('Funnelcake unavailable');
      }

      debugLog(`[useBulkVideoStats] Fetching stats for ${uniqueIds.length} videos`);

      const response = await fetchBulkVideoStats(apiUrl, uniqueIds, signal);

      // Transform to map for easy lookup
      const statsMap: Record<string, VideoStats> = {};
      for (const stat of response.stats) {
        statsMap[stat.id] = {
          id: stat.id,
          reactions: stat.reactions,
          comments: stat.comments,
          reposts: stat.reposts,
          loops: stat.loops,
          engagementScore: stat.engagement_score,
          trendingScore: stat.trending_score,
        };
      }

      return {
        stats: statsMap,
        missing: response.missing,
      };
    },
    enabled: uniqueIds.length > 0 && isFunnelcakeAvailable(apiUrl),
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

  // Populate individual video stats cache entries
  useEffect(() => {
    if (query.data?.stats) {
      Object.entries(query.data.stats).forEach(([eventId, stats]) => {
        queryClient.setQueryData(['video-stats', eventId], stats);
      });
    }
  }, [query.data, queryClient]);

  return query;
}

/**
 * Get stats for a specific video from bulk results
 */
export function getVideoStats(
  data: ReturnType<typeof useBulkVideoStats>['data'],
  eventId: string
): VideoStats | undefined {
  return data?.stats[eventId];
}
