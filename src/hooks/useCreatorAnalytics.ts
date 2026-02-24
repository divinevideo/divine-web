// ABOUTME: Hook for fetching creator analytics data from Funnelcake REST API
// ABOUTME: Fetches user videos + bulk stats + profile, computes KPIs and top content

import { useQuery } from '@tanstack/react-query';
import { API_CONFIG } from '@/config/api';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import {
  fetchUserProfile,
  fetchUserVideos,
  fetchBulkVideoStats,
} from '@/lib/funnelcakeClient';
import { buildAnalyticsData } from '@/lib/analyticsTransform';
import { debugLog } from '@/lib/debug';
import type { FunnelcakeVideoRaw } from '@/types/funnelcake';
import type { CreatorAnalyticsData } from '@/types/creatorAnalytics';

const MAX_PAGES = 4;
const PAGE_SIZE = 50;

/**
 * Paginate through all user videos (up to MAX_PAGES * PAGE_SIZE)
 * Deduplicates by pubkey:kind:d_tag
 */
async function fetchAllUserVideos(
  apiUrl: string,
  pubkey: string,
  signal: AbortSignal,
): Promise<FunnelcakeVideoRaw[]> {
  const allVideos: FunnelcakeVideoRaw[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const response = await fetchUserVideos(apiUrl, pubkey, {
      limit: PAGE_SIZE,
      offset,
      signal,
    });

    allVideos.push(...response.videos);

    if (!response.has_more) break;
  }

  // Deduplicate by pubkey:kind:d_tag (addressable event key)
  const seen = new Set<string>();
  return allVideos.filter(v => {
    const key = `${v.pubkey}:${v.kind}:${v.d_tag}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Hook to fetch and compute creator analytics
 *
 * Fetches user profile, all user videos (paginated), and bulk stats,
 * then computes KPIs and top content rankings.
 *
 * @param pubkey - Creator's hex public key
 * @returns React Query result with CreatorAnalyticsData
 */
export function useCreatorAnalytics(pubkey: string) {
  const apiUrl = API_CONFIG.funnelcake.baseUrl;

  return useQuery<CreatorAnalyticsData>({
    queryKey: ['creator-analytics', pubkey],
    queryFn: async ({ signal }) => {
      if (!pubkey) throw new Error('No pubkey provided');

      // Check circuit breaker
      if (!isFunnelcakeAvailable(apiUrl)) {
        throw new Error('Funnelcake API is not available');
      }

      debugLog(`[useCreatorAnalytics] Fetching analytics for ${pubkey}`);

      // 1. Fetch user videos and profile in parallel
      const [videos, profile] = await Promise.all([
        fetchAllUserVideos(apiUrl, pubkey, signal),
        fetchUserProfile(apiUrl, pubkey, signal),
      ]);

      debugLog(`[useCreatorAnalytics] Got ${videos.length} videos`);

      // 2. Fetch bulk stats for all videos
      const videoIds = videos
        .map(v => v.id)
        .filter(id => id && typeof id === 'string' && id.length > 0);

      const bulkStats = videoIds.length > 0
        ? await fetchBulkVideoStats(apiUrl, videoIds, signal)
        : { stats: [], missing: [] };

      debugLog(`[useCreatorAnalytics] Got stats for ${bulkStats.stats.length} videos`);

      // 3. Build analytics data from raw responses
      return buildAnalyticsData(videos, bulkStats, profile);
    },
    enabled: !!pubkey,
    staleTime: 60_000,   // 1 minute
    gcTime: 300_000,     // 5 minutes
    retry: 2,
  });
}
