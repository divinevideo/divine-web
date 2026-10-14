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
import { videoAddress } from '@/lib/videoAddress';
import type { ParsedVideoData } from '@/types/video';
import type { SortMode } from '@/types/nostr';
import type { ResolvedFeaturedTab } from '@/types/featuredTabs';

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
  featuredNavigationState: FeaturedNavigationState;
  featuredTab: ResolvedFeaturedTab | null;
  windowOffset: number;
  fetchedCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<ParsedVideoData[] | null>;
  isLoading: boolean;
  error: Error | null;
}

const NAVIGATION_WINDOW_SIZE = 16;
const NAVIGATION_PAGE_BUDGET = 5;

type NavigationVideo = ParsedVideoData & { navigationIndex?: number };
export type FeaturedNavigationState = 'not-featured' | 'ok' | 'unresolved' | 'tab-unavailable' | 'target-out-of-range';

interface VideoNavigationPage {
  videos: NavigationVideo[];
  offset?: number;
}

/**
 * Flatten infinite-query pages into one navigation list, dropping any row that
 * repeats across the page boundary. Offset pagination can shift a video onto two
 * consecutive pages when a publish/delete lands between fetches, so a plain
 * flatMap yields duplicate cards (and duplicate React keys). Keyed by the
 * addressable coordinate (pubkey:kind:d-tag), matching the per-response dedup in
 * transformFunnelcakeResponse.
 */
function flattenUniqueVideos(pages?: VideoNavigationPage[]): ParsedVideoData[] | null {
  if (!pages) return null;
  const seen = new Set<string>();
  const videos: ParsedVideoData[] = [];
  for (const page of pages) {
    for (const video of page.videos) {
      const key = videoAddress(video);
      if (seen.has(key)) continue;
      seen.add(key);
      videos.push(video);
    }
  }
  return videos;
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
    NAVIGATION_PAGE_BUDGET,
    Math.ceil((currentIndex + 1) / FEED_PAGE_SIZE) + 1
  );
}

function withNavigationIndexes(page: VideoNavigationPage, startIndex: number): VideoNavigationPage {
  return {
    ...page,
    videos: page.videos.map((video, index) => ({
      ...video,
      navigationIndex: startIndex + index,
    })),
  };
}

function visibleVideosFromResult(
  data: { pages: VideoNavigationPage[] } | undefined,
  blockedPubkeys: ReadonlySet<string>
): ParsedVideoData[] | null {
  return flattenUniqueVideos(filterBlockedVideoPages(data, blockedPubkeys)?.pages);
}

async function fetchVisiblePagePastBlocked(
  fetchNextPage: () => Promise<{
    data?: { pages: VideoNavigationPage[] };
    hasNextPage?: boolean;
    isError?: boolean;
    error?: Error | null;
  }>,
  currentVideos: ParsedVideoData[] | null,
  blockedPubkeys: ReadonlySet<string>,
  pageBudget: number = NAVIGATION_PAGE_BUDGET
): Promise<ParsedVideoData[] | null> {
  const startCount = currentVideos?.length ?? 0;
  let result = await fetchNextPage();
  if (result.isError) throw result.error ?? new Error('Could not load more videos');

  let visible = visibleVideosFromResult(result.data, blockedPubkeys) ?? currentVideos;
  let loadedPages = result.data?.pages.length ?? 0;
  let skipped = 0;

  while (
    (visible?.length ?? 0) <= startCount &&
    result.hasNextPage &&
    skipped < pageBudget
  ) {
    result = await fetchNextPage();
    if (result.isError) throw result.error ?? new Error('Could not load more videos');

    const nextLoadedPages = result.data?.pages.length ?? 0;
    if (nextLoadedPages <= loadedPages) break;
    loadedPages = nextLoadedPages;
    visible = visibleVideosFromResult(result.data, blockedPubkeys) ?? visible;
    skipped += 1;
  }

  return visible;
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

      return withNavigationIndexes(transformToVideoPage(response, 'offset'), Number(pageParam));
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

      return withNavigationIndexes(transformToVideoPage(response, 'offset'), Number(pageParam));
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

      return withNavigationIndexes(transformToVideoPage(response, 'offset'), Number(pageParam));
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
    () => flattenUniqueVideos(filteredUserVideosData?.pages),
    [filteredUserVideosData]
  );
  const hashtagVideos = useMemo(
    () => flattenUniqueVideos(filteredHashtagVideosData?.pages),
    [filteredHashtagVideosData]
  );
  const searchVideosForContext = useMemo(
    () => flattenUniqueVideos(filteredSearchVideosData?.pages),
    [filteredSearchVideosData]
  );
  const featuredVideos = useMemo(
    () => flattenUniqueVideos(filteredFeaturedVideosData?.pages),
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

  // Direct video links are addressable Nostr events. Feed/profile navigation is
  // filtered, but the detail fallback intentionally stays unfiltered.
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
  const featuredPagesLoaded = featuredVideosData?.pages.length ?? 0;
  const featuredNavigationState: FeaturedNavigationState = (() => {
    if (!featuredTabId) return 'not-featured';
    if (!eligibleFeaturedTabId) {
      return featuredTabState.isResolved ? 'tab-unavailable' : 'unresolved';
    }
    if (
      !contextVideo &&
      !isFeaturedVideosLoading &&
      !isFetchingNextFeaturedPage &&
      (featuredPagesLoaded >= featuredPageBudget || !featuredHasNextPage)
    ) {
      return 'target-out-of-range';
    }
    return 'ok';
  })();
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
    featuredNavigationState,
    featuredTab: featuredTabState.tab,
    windowOffset: eligibleFeaturedTabId ? 0 : windowOffset,
    fetchedCount,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: async () => {
      if (pubkey) {
        if (!userVideosQuery.hasNextPage) return userVideos;
        return fetchVisiblePagePastBlocked(userVideosQuery.fetchNextPage, userVideos, blockedPubkeys);
      }

      if (hashtag) {
        if (!hashtagVideosQuery.hasNextPage) return hashtagVideos;
        return fetchVisiblePagePastBlocked(hashtagVideosQuery.fetchNextPage, hashtagVideos, blockedPubkeys);
      }

      if (searchValue) {
        if (!searchVideosQuery.hasNextPage) return searchVideosForContext;
        return fetchVisiblePagePastBlocked(searchVideosQuery.fetchNextPage, searchVideosForContext, blockedPubkeys);
      }

      if (!eligibleFeaturedTabId || !featuredHasNextPage) return featuredVideos;
      return fetchVisiblePagePastBlocked(fetchNextFeaturedPage, featuredVideos, blockedPubkeys);
    },
    isLoading,
    error,
  };
}
