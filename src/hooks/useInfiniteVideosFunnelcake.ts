// ABOUTME: Infinite scroll hook for video feeds using Funnelcake REST API
// ABOUTME: Provides pre-computed trending scores and efficient cursor-based pagination

import { useInfiniteQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { ParsedVideoData } from '@/types/video';
import type { FunnelcakeFetchOptions } from '@/types/funnelcake';
import { fetchVideos, searchVideos, fetchUserVideos, fetchUserFeed, fetchRecommendations } from '@/lib/funnelcakeClient';
import { transformToVideoPage } from '@/lib/funnelcakeTransform';
import { debugLog } from '@/lib/debug';
import { performanceMonitor } from '@/lib/performanceMonitoring';
import { DEFAULT_FUNNELCAKE_URL } from '@/config/relays';

export type FunnelcakeFeedType = 'trending' | 'recent' | 'classics' | 'hashtag' | 'profile' | 'home' | 'recommendations';
export type FunnelcakeSortMode = 'trending' | 'recent' | 'loops' | 'engagement';

interface UseInfiniteVideosFunnelcakeOptions {
  feedType: FunnelcakeFeedType;
  apiUrl?: string;          // Override API URL (for classics always using Divine)
  sortMode?: FunnelcakeSortMode;
  hashtag?: string;         // For hashtag feed
  pubkey?: string;          // For profile and home feeds
  pageSize?: number;
  enabled?: boolean;
}

interface FunnelcakeVideoPage {
  videos: ParsedVideoData[];
  nextCursor: number | undefined;
  offset?: number;
}

/**
 * Map feed type and sort mode to Funnelcake API options
 */
function getFetchOptions(
  feedType: FunnelcakeFeedType,
  sortMode?: FunnelcakeSortMode,
  pageSize: number = 20
): FunnelcakeFetchOptions {
  const baseOptions: FunnelcakeFetchOptions = {
    limit: pageSize,
  };

  switch (feedType) {
    case 'classics':
      // Classic Vines: filter by platform=vine, sort by loops
      return {
        ...baseOptions,
        classic: true,
        platform: 'vine',
        sort: 'loops',
      };

    case 'trending':
      return {
        ...baseOptions,
        sort: sortMode || 'trending',
      };

    case 'recent':
      return {
        ...baseOptions,
        sort: 'recent',
      };

    case 'hashtag':
      return {
        ...baseOptions,
        sort: sortMode || 'trending',
      };

    case 'profile':
      return {
        ...baseOptions,
        sort: sortMode || 'recent',
      };

    case 'home':
      return {
        ...baseOptions,
        sort: sortMode || 'recent',
      };

    case 'recommendations':
      return {
        ...baseOptions,
        // Recommendations endpoint handles its own sorting
      };

    default:
      return baseOptions;
  }
}

/**
 * Infinite scroll hook for Funnelcake-powered video feeds
 *
 * Supports:
 * - trending: Videos sorted by trending score
 * - recent: Chronological videos
 * - classics: Classic Vine archive (always uses Divine's Funnelcake)
 * - hashtag: Videos with specific hashtag
 * - profile: Videos by specific user
 * - home: Personalized feed for logged-in user
 * - recommendations: AI-powered personalized recommendations (requires login)
 */
export function useInfiniteVideosFunnelcake({
  feedType,
  apiUrl,
  sortMode,
  hashtag,
  pubkey,
  pageSize = 20,
  enabled = true,
}: UseInfiniteVideosFunnelcakeOptions) {
  const { user } = useCurrentUser();

  // Determine API URL:
  // - Classics always use Divine's Funnelcake
  // - Other feeds use provided apiUrl or default
  const effectiveApiUrl = feedType === 'classics'
    ? DEFAULT_FUNNELCAKE_URL
    : (apiUrl || DEFAULT_FUNNELCAKE_URL);

  return useInfiniteQuery<FunnelcakeVideoPage, Error>({
    queryKey: ['funnelcake-videos', feedType, effectiveApiUrl, sortMode, hashtag, pubkey, pageSize],

    queryFn: async ({ pageParam, signal }) => {
      const totalStart = performance.now();

      // Handle pagination cursor
      const isOffsetParam = typeof pageParam === 'object' && pageParam !== null && 'offset' in pageParam;
      const before = isOffsetParam
        ? String((pageParam as { offset: number }).offset)
        : pageParam
          ? String(pageParam)
          : undefined;

      const options = getFetchOptions(feedType, sortMode, pageSize);
      options.before = before;
      options.signal = signal;

      debugLog(`[useInfiniteVideosFunnelcake] Fetching ${feedType} feed from ${effectiveApiUrl}`, {
        sortMode,
        before,
        pageSize,
        hashtag,
        pubkey,
      });

      const queryStart = performance.now();
      let response;

      try {
        switch (feedType) {
          case 'hashtag':
            if (!hashtag) throw new Error('Hashtag required for hashtag feed');
            response = await searchVideos(effectiveApiUrl, {
              ...options,
              tag: hashtag.toLowerCase(),
            });
            break;

          case 'profile':
            if (!pubkey) throw new Error('Pubkey required for profile feed');
            response = await fetchUserVideos(effectiveApiUrl, pubkey, options);
            break;

          case 'home':
            if (!user?.pubkey) {
              debugLog('[useInfiniteVideosFunnelcake] No user logged in for home feed');
              return { videos: [], nextCursor: undefined };
            }
            response = await fetchUserFeed(effectiveApiUrl, {
              ...options,
              pubkey: user.pubkey,
            });
            break;

          case 'recommendations':
            if (!user?.pubkey) {
              debugLog('[useInfiniteVideosFunnelcake] No user logged in for recommendations feed');
              return { videos: [], nextCursor: undefined };
            }
            response = await fetchRecommendations(effectiveApiUrl, {
              pubkey: user.pubkey,
              limit: pageSize,
              fallback: 'popular', // Fall back to popular videos if no personalized recs
              signal,
            });
            break;

          default:
            // trending, recent, classics
            response = await fetchVideos(effectiveApiUrl, options);
        }
      } catch (err) {
        debugLog(`[useInfiniteVideosFunnelcake] Fetch error:`, err);
        throw err;
      }

      const queryTime = performance.now() - queryStart;

      // Transform response to video page
      const parseStart = performance.now();
      const page = transformToVideoPage(response);
      const parseTime = performance.now() - parseStart;

      const totalTime = performance.now() - totalStart;

      // Record performance metrics
      performanceMonitor.recordQuery({
        relayUrl: effectiveApiUrl,
        queryType: `funnelcake-${feedType}`,
        duration: queryTime,
        eventCount: page.videos.length,
        filters: JSON.stringify({ feedType, sortMode, hashtag, pubkey }),
      });

      performanceMonitor.recordFeedLoad({
        feedType: `funnelcake-${feedType}`,
        queryTime,
        parseTime,
        totalTime,
        videoCount: page.videos.length,
        sortMode,
      });

      debugLog(`[useInfiniteVideosFunnelcake] Got ${page.videos.length} videos in ${queryTime.toFixed(0)}ms`, {
        hasMore: page.hasMore,
        nextCursor: page.nextCursor,
      });

      return {
        videos: page.videos,
        nextCursor: page.nextCursor,
        offset: page.offset,
      };
    },

    getNextPageParam: (lastPage) => {
      // Use offset for sorted pagination, timestamp for chronological
      if (lastPage.offset !== undefined) {
        return { offset: lastPage.offset };
      }
      return lastPage.nextCursor;
    },

    initialPageParam: undefined,

    enabled: enabled && ((feedType !== 'home' && feedType !== 'recommendations') || !!user?.pubkey),

    staleTime: 60000,  // 1 minute
    gcTime: 600000,    // 10 minutes

    meta: {
      source: 'funnelcake',
      apiUrl: effectiveApiUrl,
    },
  });
}
