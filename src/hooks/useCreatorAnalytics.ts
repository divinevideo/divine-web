// ABOUTME: Hook for fetching creator analytics data from Funnelcake REST API
// ABOUTME: Single server-aggregated call + small bulk metadata fetch for top-N posts

import { useQuery } from '@tanstack/react-query';
import { API_CONFIG } from '@/config/api';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import {
  fetchUserProfile,
  fetchCreatorAnalytics,
  fetchBulkVideos,
} from '@/lib/funnelcakeClient';
import { buildAnalyticsData } from '@/lib/analyticsTransform';
import { debugLog } from '@/lib/debug';
import type {
  CreatorAnalyticsData,
  CreatorAnalyticsWindow,
} from '@/types/creatorAnalytics';

const DEFAULT_WINDOW: CreatorAnalyticsWindow = '30d';

/**
 * Fetch and assemble creator analytics for the dashboard.
 *
 * Issues at most two API calls:
 *   1. `GET /api/users/{pubkey}/analytics` (NIP-98) - totals, timeseries, top-N IDs
 *   2. `POST /api/videos/bulk` - metadata for just the top-N IDs (≤10 by default)
 * Plus an unauthenticated profile fetch for the absolute follower count.
 *
 * Caller must be authenticated as `pubkey` (the analytics endpoint refuses
 * cross-account access); the dashboard page already gates on that.
 */
export function useCreatorAnalytics(
  pubkey: string,
  window: CreatorAnalyticsWindow = DEFAULT_WINDOW,
) {
  const apiUrl = API_CONFIG.funnelcake.baseUrl;
  const { signer } = useCurrentUser();

  return useQuery<CreatorAnalyticsData>({
    queryKey: ['creator-analytics', pubkey, window],
    queryFn: async ({ signal }) => {
      if (!pubkey) throw new Error('No pubkey provided');
      if (!signer) throw new Error('Signer not available - cannot authenticate analytics request');

      if (!isFunnelcakeAvailable(apiUrl)) {
        throw new Error('Funnelcake API is not available');
      }

      debugLog(`[useCreatorAnalytics] Fetching analytics for ${pubkey} window=${window}`);

      const [analytics, profile] = await Promise.all([
        fetchCreatorAnalytics(apiUrl, pubkey, signer, { window, signal }),
        fetchUserProfile(apiUrl, pubkey, signal),
      ]);

      debugLog(
        `[useCreatorAnalytics] Got analytics: ${analytics.summary.video_count ?? 0} videos, ${analytics.top_posts.length} top posts`,
      );

      const topIds = analytics.top_posts.map(p => p.id).filter(Boolean);
      const topVideoMetadata = topIds.length > 0
        ? (await fetchBulkVideos(apiUrl, topIds, signal)).videos
        : [];

      return buildAnalyticsData(analytics, topVideoMetadata, profile);
    },
    enabled: !!pubkey && !!signer,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: 2,
  });
}
