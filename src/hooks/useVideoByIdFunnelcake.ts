// ABOUTME: Hook to fetch a single video by ID via Funnelcake REST API
// ABOUTME: Provides fast video lookup for VideoPage with profile and hashtag context support

import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getFunnelcakeBaseUrl } from '@/config/api';
import { fetchVideoById, fetchUserVideos, searchVideos } from '@/lib/funnelcakeClient';
import { transformFunnelcakeVideo, transformToVideoPage } from '@/lib/funnelcakeTransform';
import { getFunnelcakeUrl } from '@/config/relays';
import { useAppContext } from '@/hooks/useAppContext';
import { useFeaturedTab } from '@/hooks/useFeaturedTab';
import { useFeaturedTabVideos } from '@/hooks/useFeaturedTabVideos';
import { useFeedBlocklist } from '@/hooks/useFeedBlocklist';
import { FEED_PAGE_SIZE } from '@/config/feed';
import { filterBlockedVideoPages } from '@/lib/blocklistFilter';
import { debugLog } from '@/lib/debug';
import type { ParsedVideoData } from '@/types/video';
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
  fetchedCount: number;
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

interface VideoNavigationPage {
  videos: ParsedVideoData[];
  offset?: number;
  hasMore: boolean;
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

  const userVideosQuery = useInfiniteQuery<VideoNavigationPage, Error>({
    queryKey: ['funnelcake-user-videos', pubkey, funnelcakeUrl, windowOffset],
    queryFn: async ({ pageParam, signal }) => {
      if (!pubkey) {
        throw new Error('User pubkey is required');
      }

      debugLog(`[useVideoByIdFunnelcake] Fetching user videos for ${pubkey}`);
      const response = await fetchUserVideos(funnelcakeUrl, pubkey, {
        limit: NAVIGATION_WINDOW_SIZE,
        offset: Number(pageParam),
        sort: 'recent',
        signal,
      });

      return transformToVideoPage(response, 'offset');
    },
    initialPageParam: windowOffset,
    getNextPageParam: (lastPage) => lastPage.offset,
    enabled: enabled && !!pubkey,
    staleTime: 300000, // 5 minutes
    gcTime: 900000,    // 15 minutes
  });

  const hashtagVideosQuery = useInfiniteQuery<VideoNavigationPage, Error>({
    queryKey: ['funnelcake-hashtag-videos', hashtag, funnelcakeUrl, windowOffset],
    queryFn: async ({ pageParam, signal }) => {
      if (!hashtag) {
        throw new Error('Hashtag is required');
      }

      debugLog(`[useVideoByIdFunnelcake] Fetching hashtag videos for #${hashtag}`);
      const response = await searchVideos(funnelcakeUrl, {
        tag: hashtag,
        limit: NAVIGATION_WINDOW_SIZE,
        offset: Number(pageParam),
        signal,
      });

      return transformToVideoPage(response, 'offset');
    },
    initialPageParam: windowOffset,
    getNextPageParam: (lastPage) => lastPage.offset,
    enabled: enabled && !!hashtag && !pubkey, // Only fetch if hashtag context and no pubkey
    staleTime: 300000, // 5 minutes
    gcTime: 900000,    // 15 minutes
  });

  const searchVideosQuery = useInfiniteQuery<VideoNavigationPage, Error>({
    queryKey: ['funnelcake-search-videos', searchValue, sortMode, funnelcakeUrl, windowOffset],
    queryFn: async ({ pageParam, signal }) => {
      if (!searchValue) {
        throw new Error('Search query is required');
      }

      debugLog(`[useVideoByIdFunnelcake] Fetching search videos for ${searchValue}`);
      const response = await searchVideos(funnelcakeUrl, {
        query: isHashtagSearch ? undefined : searchValue,
        tag: isHashtagSearch ? searchValue : undefined,
        sort: mapSearchSortModeToFunnelcakeSort(sortMode),
        limit: NAVIGATION_WINDOW_SIZE,
        offset: Number(pageParam),
        classic: sortMode === 'classic' ? true : undefined,
        platform: sortMode === 'classic' ? 'vine' : undefined,
        signal,
      });

      return transformToVideoPage(response, 'offset');
    },
    initialPageParam: windowOffset,
    getNextPageParam: (lastPage) => lastPage.offset,
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
  const filteredUserVideosData = useMemo(
    () => filterBlockedVideoPages(userVideosQuery.data, blockedPubkeys),
    [userVideosQuery.data, blockedPubkeys]
  );
  const filteredHashtagVideosData = useMemo(
    () => filterBlockedVideoPages(hashtagVideosQuery.data, blockedPubkeys),
    [hashtagVideosQuery.data, blockedPubkeys]
  );
  const filteredSearchVideosData = useMemo(
    () => filterBlockedVideoPages(searchVideosQuery.data, blockedPubkeys),
    [searchVideosQuery.data, blockedPubkeys]
  );
  const userVideos = useMemo(
    () => filteredUserVideosData?.pages.flatMap((page) => page.videos) ?? null,
    [filteredUserVideosData]
  );
  const hashtagVideos = useMemo(
    () => filteredHashtagVideosData?.pages.flatMap((page) => page.videos) ?? null,
    [filteredHashtagVideosData]
  );
  const searchVideosForContext = useMemo(
    () => filteredSearchVideosData?.pages.flatMap((page) => page.videos) ?? null,
    [filteredSearchVideosData]
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

  const contextVideos = userVideos ?? hashtagVideos ?? searchVideosForContext ?? featuredVideos ?? null;
  const contextVideo = contextVideos?.find(v => v.id === videoId || v.vineId === videoId) || null;
  let contextLoading = false;
  if (pubkey) {
    contextLoading = userVideosQuery.isLoading;
  } else if (hashtag) {
    contextLoading = hashtagVideosQuery.isLoading;
  } else if (searchValue) {
    contextLoading = searchVideosQuery.isLoading;
  } else if (eligibleFeaturedTabId) {
    contextLoading = isFeaturedVideosLoading || isFetchingNextFeaturedPage;
  }

  let contextError: Error | null = null;
  if (pubkey) {
    contextError = userVideosQuery.error as Error | null;
  } else if (hashtag) {
    contextError = hashtagVideosQuery.error as Error | null;
  } else if (searchValue) {
    contextError = searchVideosQuery.error as Error | null;
  } else if (eligibleFeaturedTabId) {
    contextError = featuredVideosError as Error | null;
  }
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
  const fetchedCount = pubkey
    ? (userVideosQuery.data?.pages.reduce((sum, page) => sum + page.videos.length, 0) ?? 0)
    : hashtag
      ? (hashtagVideosQuery.data?.pages.reduce((sum, page) => sum + page.videos.length, 0) ?? 0)
      : searchValue
        ? (searchVideosQuery.data?.pages.reduce((sum, page) => sum + page.videos.length, 0) ?? 0)
        : eligibleFeaturedTabId
          ? (featuredVideosData?.pages.reduce((sum, page) => sum + page.videos.length, 0) ?? 0)
          : 0;
  const hasNextPage = pubkey
    ? Boolean(userVideosQuery.hasNextPage)
    : hashtag
      ? Boolean(hashtagVideosQuery.hasNextPage)
      : searchValue
        ? Boolean(searchVideosQuery.hasNextPage)
        : Boolean(eligibleFeaturedTabId && featuredHasNextPage);
  const isFetchingNextPage = pubkey
    ? userVideosQuery.isFetchingNextPage
    : hashtag
      ? hashtagVideosQuery.isFetchingNextPage
      : searchValue
        ? searchVideosQuery.isFetchingNextPage
        : Boolean(eligibleFeaturedTabId && isFetchingNextFeaturedPage);

  return {
    video,
    videos,
    windowOffset: eligibleFeaturedTabId ? 0 : windowOffset,
    fetchedCount,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: async () => {
      if (pubkey) {
        if (!userVideosQuery.hasNextPage) return userVideos;
        const result = await userVideosQuery.fetchNextPage();
        return filterBlockedVideoPages(result.data, blockedPubkeys)
          ?.pages.flatMap((page) => page.videos) ?? userVideos;
      }

      if (hashtag) {
        if (!hashtagVideosQuery.hasNextPage) return hashtagVideos;
        const result = await hashtagVideosQuery.fetchNextPage();
        return filterBlockedVideoPages(result.data, blockedPubkeys)
          ?.pages.flatMap((page) => page.videos) ?? hashtagVideos;
      }

      if (searchValue) {
        if (!searchVideosQuery.hasNextPage) return searchVideosForContext;
        const result = await searchVideosQuery.fetchNextPage();
        return filterBlockedVideoPages(result.data, blockedPubkeys)
          ?.pages.flatMap((page) => page.videos) ?? searchVideosForContext;
      }

      if (!eligibleFeaturedTabId || !featuredHasNextPage) return featuredVideos;

      const startCount = featuredVideos?.length ?? 0;
      let result = await fetchNextFeaturedPage();
      let visible = filterBlockedVideoPages(result.data, blockedPubkeys)
        ?.pages.flatMap((page) => page.videos) ?? featuredVideos;
      let loadedPages = result.data?.pages.length ?? 0;

      // A featured page can be entirely blocked/muted authors; filtered to
      // nothing it would surface as a spurious "couldn't load next" toast at the
      // boundary even though visible videos remain further in. Skip past
      // fully-filtered pages until a visible neighbor appears or the tab ends.
      // Bounded per keypress, and it stops the moment a fetch makes no progress
      // (error or no-op) so a failing page can't spin the loop.
      let skipped = 0;
      while (
        (visible?.length ?? 0) <= startCount &&
        result.hasNextPage &&
        skipped < FEATURED_NAVIGATION_PAGE_BUDGET
      ) {
        result = await fetchNextFeaturedPage();
        const nextLoadedPages = result.data?.pages.length ?? 0;
        if (nextLoadedPages <= loadedPages) break;
        loadedPages = nextLoadedPages;
        visible = filterBlockedVideoPages(result.data, blockedPubkeys)
          ?.pages.flatMap((page) => page.videos) ?? visible;
        skipped += 1;
      }

      return visible;
    },
    isLoading,
    error,
  };
}
