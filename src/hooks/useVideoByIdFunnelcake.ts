// ABOUTME: Hook to fetch a single video by ID via Funnelcake REST API
// ABOUTME: Provides fast video lookup for VideoPage with profile and hashtag context support

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFunnelcakeBaseUrl } from '@/config/api';
import { fetchVideoById, fetchUserVideos, searchVideos } from '@/lib/funnelcakeClient';
import { transformFunnelcakeVideo } from '@/lib/funnelcakeTransform';
import { getFunnelcakeUrl } from '@/config/relays';
import { useAppContext } from '@/hooks/useAppContext';
import { useFeaturedTab } from '@/hooks/useFeaturedTab';
import { useFeaturedTabVideos } from '@/hooks/useFeaturedTabVideos';
import { useFeedBlocklist } from '@/hooks/useFeedBlocklist';
import { FEED_PAGE_SIZE } from '@/config/feed';
import { filterBlockedVideoPages } from '@/lib/blocklistFilter';
import { debugLog } from '@/lib/debug';
import type { ParsedVideoData } from '@/types/video';
import type { FunnelcakeVideoRaw } from '@/types/funnelcake';
import type { SortMode } from '@/types/nostr';

interface UseVideoByIdOptions {
  videoId: string;
  pubkey?: string;   // Optional pubkey for profile context
  hashtag?: string;  // Optional hashtag for hashtag feed context
  query?: string;    // Optional search query for bounded search navigation
  featuredTabId?: string;
  sortMode?: SortMode | 'relevance';
  currentIndex?: number; // Optional global index from feed context for neighbor windowing
  enabled?: boolean;
}

interface UseVideoByIdResult {
  video: ParsedVideoData | null;
  videos: ParsedVideoData[] | null;  // Neighboring videos for navigation
  windowOffset: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<ParsedVideoData[] | null>;
  isLoading: boolean;
  error: Error | null;
}

const NAVIGATION_WINDOW_SIZE = 16;
// Cold featured links must page forward by cursor to rebuild enough filtered
// server-order context, but the detail page should not drain an unbounded tab.
const FEATURED_NAVIGATION_PAGE_BUDGET = 5;

/** Drop rows the transform refuses — a video with no `d` tag has no coordinate. */
function transformNavigationVideos(rawVideos: FunnelcakeVideoRaw[]): ParsedVideoData[] {
  return rawVideos.flatMap(raw => {
    const video = transformFunnelcakeVideo(raw);
    return video ? [video] : [];
  });
}

function getNavigationWindowOffset(currentIndex?: number): number {
  if (currentIndex === undefined || currentIndex < 0) {
    return 0;
  }
  return Math.max(0, currentIndex - Math.floor(NAVIGATION_WINDOW_SIZE / 2));
}

function mapSearchSortModeToFunnelcakeSort(sortMode: SortMode | 'relevance' = 'relevance') {
  switch (sortMode) {
    case 'top':
      return 'loops' as const;
    case 'rising':
    case 'controversial':
      return 'engagement' as const;
    case 'classic':
      return 'loops' as const;
    case 'hot':
    case 'relevance':
    default:
      return 'trending' as const;
  }
}

function getFeaturedNavigationPageBudget(currentIndex?: number): number {
  if (currentIndex === undefined || currentIndex < 0) {
    return 1;
  }

  return Math.min(
    FEATURED_NAVIGATION_PAGE_BUDGET,
    Math.ceil((currentIndex + 1) / FEED_PAGE_SIZE) + 1
  );
}

/**
 * Hook to fetch a single video by ID via Funnelcake REST API
 *
 * If pubkey is provided, fetches all videos from that user for navigation context.
 * If hashtag is provided, fetches videos from that hashtag for navigation context.
 * The single video lookup is faster than WebSocket queries.
 */
export function useVideoByIdFunnelcake(options: UseVideoByIdOptions): UseVideoByIdResult {
  const { videoId, pubkey, hashtag, query, featuredTabId, sortMode = 'relevance', currentIndex, enabled = true } = options;
  const { config } = useAppContext();
  const blockedPubkeys = useFeedBlocklist();
  const windowOffset = getNavigationWindowOffset(currentIndex);
  const featuredPageBudget = getFeaturedNavigationPageBudget(currentIndex);
  const trimmedQuery = query?.trim();
  const isHashtagSearch = !!trimmedQuery && trimmedQuery.startsWith('#');
  const searchValue = isHashtagSearch ? trimmedQuery?.slice(1).toLowerCase() : trimmedQuery;

  // Determine API URL from current relay
  const funnelcakeUrl = getFunnelcakeUrl(config.relayUrl) || getFunnelcakeBaseUrl();
  const featuredTabState = useFeaturedTab({
    apiUrl: funnelcakeUrl,
    enabled: enabled && !!featuredTabId,
  });
  const eligibleFeaturedTabId = featuredTabState.tab?.id === featuredTabId
    ? featuredTabId
    : undefined;

  // If we have a pubkey, fetch all their videos for navigation context
  const userVideosQuery = useQuery({
    queryKey: ['funnelcake-user-videos', pubkey, funnelcakeUrl, windowOffset],
    queryFn: async ({ signal }) => {
      if (!pubkey) return null;

      debugLog(`[useVideoByIdFunnelcake] Fetching user videos for ${pubkey}`);
      const response = await fetchUserVideos(funnelcakeUrl, pubkey, {
        limit: NAVIGATION_WINDOW_SIZE,
        offset: windowOffset,
        sort: 'recent',
        signal,
      });

      return transformNavigationVideos(response.videos);
    },
    enabled: enabled && !!pubkey,
    staleTime: 300000, // 5 minutes
    gcTime: 900000,    // 15 minutes
  });

  // If we have a hashtag, fetch videos from that hashtag for navigation context
  const hashtagVideosQuery = useQuery({
    queryKey: ['funnelcake-hashtag-videos', hashtag, funnelcakeUrl, windowOffset],
    queryFn: async ({ signal }) => {
      if (!hashtag) return null;

      debugLog(`[useVideoByIdFunnelcake] Fetching hashtag videos for #${hashtag}`);
      const response = await searchVideos(funnelcakeUrl, {
        tag: hashtag,
        limit: NAVIGATION_WINDOW_SIZE,
        offset: windowOffset,
        signal,
      });

      return transformNavigationVideos(response.videos);
    },
    enabled: enabled && !!hashtag && !pubkey, // Only fetch if hashtag context and no pubkey
    staleTime: 300000, // 5 minutes
    gcTime: 900000,    // 15 minutes
  });

  const searchVideosQuery = useQuery({
    queryKey: ['funnelcake-search-videos', searchValue, sortMode, funnelcakeUrl, windowOffset],
    queryFn: async ({ signal }) => {
      if (!searchValue) return null;

      debugLog(`[useVideoByIdFunnelcake] Fetching search videos for ${searchValue}`);
      const response = await searchVideos(funnelcakeUrl, {
        query: isHashtagSearch ? undefined : searchValue,
        tag: isHashtagSearch ? searchValue : undefined,
        sort: mapSearchSortModeToFunnelcakeSort(sortMode),
        limit: NAVIGATION_WINDOW_SIZE,
        offset: windowOffset,
        classic: sortMode === 'classic' ? true : undefined,
        platform: sortMode === 'classic' ? 'vine' : undefined,
        signal,
      });

      return transformNavigationVideos(response.videos);
    },
    enabled: enabled && !!searchValue && !pubkey && !hashtag,
    staleTime: 300000,
    gcTime: 900000,
  });

  const featuredVideosQuery = useFeaturedTabVideos({
    configId: eligibleFeaturedTabId,
    apiUrl: funnelcakeUrl,
    pageSize: FEED_PAGE_SIZE,
    enabled: enabled && !!eligibleFeaturedTabId && !pubkey && !hashtag && !searchValue,
  });
  const {
    data: featuredVideosData,
    error: featuredVideosError,
    fetchNextPage: fetchNextFeaturedPage,
    hasNextPage: featuredHasNextPage,
    isFetchingNextPage: isFetchingNextFeaturedPage,
    isLoading: isFeaturedVideosLoading,
  } = featuredVideosQuery;
  const filteredFeaturedVideosData = useMemo(
    () => filterBlockedVideoPages(featuredVideosData, blockedPubkeys),
    [featuredVideosData, blockedPubkeys]
  );
  const featuredVideos = useMemo(
    () => filteredFeaturedVideosData?.pages.flatMap((page) => page.videos) ?? null,
    [filteredFeaturedVideosData]
  );
  const featuredContextVideo = featuredVideos?.find(v => v.id === videoId || v.vineId === videoId) || null;
  const hasEnoughFeaturedNeighbors = currentIndex === undefined || currentIndex < 0
    ? Boolean(featuredContextVideo)
    : Boolean(featuredVideos && featuredVideos.length > currentIndex + 1);

  useEffect(() => {
    if (
      !eligibleFeaturedTabId ||
      (featuredContextVideo && hasEnoughFeaturedNeighbors) ||
      !featuredHasNextPage ||
      isFetchingNextFeaturedPage ||
      (featuredVideosData?.pages.length ?? 0) >= featuredPageBudget
    ) {
      return;
    }

    void fetchNextFeaturedPage();
  }, [
    eligibleFeaturedTabId,
    featuredContextVideo,
    hasEnoughFeaturedNeighbors,
    featuredHasNextPage,
    isFetchingNextFeaturedPage,
    featuredVideosData,
    featuredPageBudget,
    fetchNextFeaturedPage,
  ]);

  const contextVideos = userVideosQuery.data ?? hashtagVideosQuery.data ?? searchVideosQuery.data ?? featuredVideos ?? null;
  const contextVideo = contextVideos?.find(v => v.id === videoId || v.vineId === videoId) || null;
  const contextLoading = pubkey
    ? userVideosQuery.isLoading
    : hashtag
      ? hashtagVideosQuery.isLoading
      : searchValue
        ? searchVideosQuery.isLoading
        : eligibleFeaturedTabId
          ? isFeaturedVideosLoading || isFetchingNextFeaturedPage
        : false;
  const contextError = pubkey
    ? (userVideosQuery.error as Error | null)
    : hashtag
      ? (hashtagVideosQuery.error as Error | null)
      : searchValue
        ? (searchVideosQuery.error as Error | null)
        : eligibleFeaturedTabId
          ? (featuredVideosError as Error | null)
        : null;
  const shouldLookupSingleVideo = enabled && !!videoId && (
    !contextVideo
  );

  // Single video lookup (used when no context or as fallback)
  const singleVideoQuery = useQuery({
    queryKey: ['funnelcake-video', videoId, funnelcakeUrl],
    queryFn: async ({ signal }) => {
      debugLog(`[useVideoByIdFunnelcake] Fetching single video ${videoId}`);
      const video = await fetchVideoById(funnelcakeUrl, videoId, pubkey, signal);

      if (!video) return null;
      return transformFunnelcakeVideo(video);
    },
    // Fall back to a direct lookup when the narrowed context window misses the target.
    enabled: shouldLookupSingleVideo,
    staleTime: 300000,
    gcTime: 900000,
  });

  const video = contextVideo || singleVideoQuery.data || null;
  const videos = contextVideo ? contextVideos : null;
  const isLoading = contextLoading || singleVideoQuery.isLoading;
  const error = video
    ? null
    : ((singleVideoQuery.error as Error | null) || contextError);

  return {
    video,
    videos,
    windowOffset: eligibleFeaturedTabId ? 0 : windowOffset,
    hasNextPage: Boolean(eligibleFeaturedTabId && featuredHasNextPage),
    isFetchingNextPage: Boolean(eligibleFeaturedTabId && isFetchingNextFeaturedPage),
    fetchNextPage: async () => {
      if (!eligibleFeaturedTabId || !featuredHasNextPage) return featuredVideos;

      const result = await fetchNextFeaturedPage();
      return filterBlockedVideoPages(result.data, blockedPubkeys)
        ?.pages.flatMap((page) => page.videos) ?? featuredVideos;
    },
    isLoading,
    error,
  };
}
