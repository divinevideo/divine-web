// ABOUTME: Infinite scroll search hook for video events
// ABOUTME: Uses Funnelcake REST API for fast search, falls back to NIP-50 WebSocket

import { useInfiniteQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useState, useEffect } from 'react';
import { VIDEO_KINDS, type ParsedVideoData } from '@/types/video';
import type { NIP50Filter, SortMode } from '@/types/nostr';
import { parseVideoEvents } from '@/lib/videoParser';
import { searchVideos } from '@/lib/funnelcakeClient';
import { API_CONFIG } from '@/config/api';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { debugLog } from '@/lib/debug';
import { transformToVideoPage } from '@/lib/funnelcakeTransform';
import { isAbortError, reportFunnelcakeFallback } from '@/lib/funnelcakeFallbackReporting';
import { isUrlLikeQuery } from '@/lib/searchUtils';
import { FEED_PAGE_SIZE } from '@/config/feed';
import {
  nextSortedOffset,
  RAW_FEED_BACKFILL_ATTEMPTS,
  sortedFeedHasMore,
  sortedFeedWindowSize,
} from '@/lib/sortedFeedWindow';

interface UseInfiniteSearchVideosOptions {
  query: string;
  searchType?: 'content' | 'author' | 'auto';
  sortMode?: SortMode | 'relevance';
  pageSize?: number;
}

interface VideoPage {
  videos: ParsedVideoData[];
  nextPageParam?: SearchPageParam;
}

type SearchPageParam =
  | { type: 'funnelcake-offset'; offset: number }
  | { type: 'relay-timestamp'; until: number }
  | { type: 'relay-offset'; offset: number };

function isPageParamNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delay <= 0) {
      setDebounced(value);
      return;
    }

    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function mapSearchSortModeToFunnelcakeSort(sortMode: SortMode | 'relevance') {
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

function parseSearchQuery(query: string, searchType: 'content' | 'author' | 'auto') {
  const trimmedQuery = query.trim();

  if (searchType === 'author') {
    return { type: 'author', value: trimmedQuery };
  }

  if (searchType === 'content') {
    if (trimmedQuery.startsWith('#')) {
      return { type: 'hashtag', value: trimmedQuery.slice(1).toLowerCase() };
    }
    return { type: 'content', value: trimmedQuery };
  }

  if (trimmedQuery.startsWith('#')) {
    return { type: 'hashtag', value: trimmedQuery.slice(1).toLowerCase() };
  }

  return { type: 'content', value: trimmedQuery };
}

function getFunnelcakeOffset(pageParam: unknown): number | undefined {
  return isSearchPageParam(pageParam) && pageParam.type === 'funnelcake-offset'
    ? pageParam.offset
    : undefined;
}

function getRelayTimestamp(pageParam: unknown): number | undefined {
  return isSearchPageParam(pageParam) && pageParam.type === 'relay-timestamp'
    ? pageParam.until
    : undefined;
}

function getRelayOffset(pageParam: unknown): number {
  if (!isSearchPageParam(pageParam)) {
    return 0;
  }

  return pageParam.type === 'relay-offset'
    ? pageParam.offset
    : 0;
}

function isSearchPageParam(pageParam: unknown): pageParam is SearchPageParam {
  return typeof pageParam === 'object'
    && pageParam !== null
    && 'type' in pageParam
    && (
      ((pageParam as { type?: unknown; offset?: unknown }).type === 'funnelcake-offset'
        && isPageParamNumber((pageParam as { offset?: unknown }).offset))
      || ((pageParam as { type?: unknown; until?: unknown }).type === 'relay-timestamp'
        && isPageParamNumber((pageParam as { until?: unknown }).until))
      || ((pageParam as { type?: unknown; offset?: unknown }).type === 'relay-offset'
        && isPageParamNumber((pageParam as { offset?: unknown }).offset))
    );
}

async function fetchChronologicalRelayPage({
  nostr,
  filter,
  pageSize,
  signal,
}: {
  nostr: { query: (filters: NIP50Filter[], opts: { signal: AbortSignal }) => Promise<NostrEvent[]> };
  filter: NIP50Filter;
  pageSize: number;
  signal: AbortSignal;
}): Promise<{ events: NostrEvent[]; videos: ParsedVideoData[] }> {
  let events: NostrEvent[] = [];
  let videos: ParsedVideoData[] = [];
  const queryFilter = { ...filter, limit: pageSize };

  for (let attempt = 0; attempt < RAW_FEED_BACKFILL_ATTEMPTS; attempt++) {
    events = await nostr.query([{ ...queryFilter }], { signal });
    videos = parseVideoEvents(events);

    if (videos.length > 0 || events.length < pageSize) {
      break;
    }

    const lastEvent = events[events.length - 1];
    if (!lastEvent) {
      break;
    }
    queryFilter.until = lastEvent.created_at - 1;
  }

  return { events, videos };
}

async function fetchRankedRelayPage({
  nostr,
  filter,
  pageSize,
  offset,
  signal,
}: {
  nostr: { query: (filters: NIP50Filter[], opts: { signal: AbortSignal }) => Promise<NostrEvent[]> };
  filter: NIP50Filter;
  pageSize: number;
  offset: number;
  signal: AbortSignal;
}): Promise<{ events: NostrEvent[]; videos: ParsedVideoData[]; requestedLimit: number }> {
  let events: NostrEvent[] = [];
  let videos: ParsedVideoData[] = [];
  let requestedLimit = pageSize;

  for (let attempt = 0; attempt < RAW_FEED_BACKFILL_ATTEMPTS; attempt++) {
    requestedLimit = offset + sortedFeedWindowSize(pageSize, attempt);
    events = await nostr.query([{ ...filter, limit: requestedLimit }], { signal });
    videos = parseVideoEvents(events.slice(offset));

    if (videos.length > 0 || events.length < requestedLimit) {
      break;
    }
  }

  return { events, videos, requestedLimit };
}

export function useInfiniteSearchVideos({
  query,
  searchType = 'auto',
  sortMode = 'relevance',
  pageSize = FEED_PAGE_SIZE,
}: UseInfiniteSearchVideosOptions) {
  const { nostr } = useNostr();
  const apiUrl = API_CONFIG.funnelcake.baseUrl;

  const isTest = process.env.NODE_ENV === 'test';
  const debounceMs = isTest ? 0 : 300;
  const debouncedQuery = useDebouncedValue(query, debounceMs);

  const queryResult = useInfiniteQuery<VideoPage, Error>({
    queryKey: ['infinite-search-videos', debouncedQuery, searchType, sortMode, pageSize],
    queryFn: async ({ pageParam, signal }) => {
      if (!debouncedQuery.trim()) {
        return { videos: [] };
      }

      // Skip URL-like queries that cause Funnelcake 500 errors (#166)
      if (isUrlLikeQuery(debouncedQuery)) {
        return { videos: [] };
      }

      const requestStartedAt = performance.now();
      const funnelcakeOffset = getFunnelcakeOffset(pageParam);
      const relayTimestamp = getRelayTimestamp(pageParam);
      const relayOffset = getRelayOffset(pageParam);
      const searchParams = parseSearchQuery(debouncedQuery, searchType);
      const funnelcakeAvailable = isFunnelcakeAvailable(apiUrl);
      // Author search resolves pubkeys through Funnelcake and then pages the relay
      // chronologically, so it may re-enter Funnelcake on a relay-timestamp param.
      // A relay-offset param means we already fell over to the ranked window, which
      // has no timestamp cursor to resume from — re-entering there would rewind the
      // author feed to its newest page (#560).
      const canUseFunnelcake = funnelcakeAvailable
        && (
          !isSearchPageParam(pageParam)
          || pageParam.type === 'funnelcake-offset'
          || (searchParams.type === 'author' && pageParam.type === 'relay-timestamp')
        );
      const requestContext = {
        query: debouncedQuery,
        parsedType: searchParams.type,
        parsedValue: searchParams.value,
        searchType,
        sortMode,
        pageParam: isSearchPageParam(pageParam) ? pageParam : null,
        pageSize,
      };

      console.info('[search/videos] starting', {
        ...requestContext,
        debounceMs,
      });

      const abortSignal = AbortSignal.any([
        signal,
        AbortSignal.timeout(8000),
      ]);

      if (canUseFunnelcake) {
        try {
          const funnelcakeSort = mapSearchSortModeToFunnelcakeSort(sortMode);

          if (searchParams.type === 'hashtag' || searchParams.type === 'content') {
            const apiStartedAt = performance.now();
            const result = await searchVideos(apiUrl, {
              query: searchParams.type === 'content' ? searchParams.value : undefined,
              tag: searchParams.type === 'hashtag' ? searchParams.value : undefined,
              sort: funnelcakeSort,
              limit: pageSize,
              offset: funnelcakeOffset,
              classic: sortMode === 'classic' ? true : undefined,
              platform: sortMode === 'classic' ? 'vine' : undefined,
              signal: abortSignal,
            });
            const page = transformToVideoPage(result, 'offset');
            const apiCompletedAt = performance.now();
            const nextCursor = page.offset ?? page.nextCursor;
            const nextPageParam = !isPageParamNumber(nextCursor)
              ? undefined
              : { type: 'funnelcake-offset' as const, offset: nextCursor };

            console.info('[search/videos] funnelcake query complete', {
              ...requestContext,
              mode: 'funnelcake',
              apiMs: Math.round(apiCompletedAt - apiStartedAt),
              totalMs: Math.round(apiCompletedAt - requestStartedAt),
              returnedVideoCount: page.videos.length,
              hasMore: result.has_more,
              nextCursor: nextCursor ?? null,
            });

            return {
              videos: page.videos,
              nextPageParam,
            };
          }

          if (searchParams.type === 'author') {
            const { searchProfiles } = await import('@/lib/funnelcakeClient');
            const profiles = await searchProfiles(apiUrl, {
              query: searchParams.value,
              limit: 10,
              sortBy: 'relevance',
              hasVideos: true,
              signal: abortSignal,
            });
            const pubkeys = profiles.map(profile => profile.pubkey);

            if (pubkeys.length === 0) {
              return { videos: [] };
            }

            const filter: NIP50Filter = {
              kinds: VIDEO_KINDS,
              authors: pubkeys,
              limit: pageSize,
            };
            if (relayTimestamp) {
              filter.until = relayTimestamp;
            }

            const relayStartedAt = performance.now();
            const { events, videos } = await fetchChronologicalRelayPage({
              nostr,
              filter,
              pageSize,
              signal: abortSignal,
            });
            const relayCompletedAt = performance.now();
            const rawCursor = events.length > 0
              ? events[events.length - 1].created_at - 1
              : undefined;

            console.info('[search/videos] author query complete', {
              ...requestContext,
              relayMs: Math.round(relayCompletedAt - relayStartedAt),
              totalMs: Math.round(relayCompletedAt - requestStartedAt),
              matchingAuthorCount: pubkeys.length,
              eventCount: events.length,
              videoCount: videos.length,
            });

            return {
              videos,
              nextPageParam: videos.length > 0 && rawCursor !== undefined
                ? { type: 'relay-timestamp', until: rawCursor }
                : undefined,
            };
          }
        } catch (error) {
          // Cancelled queries (fast typing, navigation away) are not failures —
          // surface the abort to React Query without reporting or falling back (#459)
          if (isAbortError(error)) {
            throw error;
          }
          // console.info: Sentry's captureConsoleIntegration captures warn/error,
          // and the fallback already reports one canonical FunnelcakeFallbackError (#459)
          console.info('[search/videos] funnelcake query failed, falling back to relay search', {
            ...requestContext,
            error,
            totalMs: Math.round(performance.now() - requestStartedAt),
          });
          debugLog('[useInfiniteSearchVideos] Funnelcake search failed, falling back to NIP-50:', error);
          reportFunnelcakeFallback({
            source: 'useInfiniteSearchVideos',
            apiUrl,
            reason: error instanceof Error ? error.message : String(error),
            error,
            dedupeKey: `useInfiniteSearchVideos:${searchParams.type}:${debouncedQuery}`,
            context: {
              query: debouncedQuery,
              searchType: searchParams.type,
            },
          });
        }
      } else if (!funnelcakeAvailable) {
        console.info('[search/videos] funnelcake unavailable, falling back to relay search', {
          ...requestContext,
          totalMs: Math.round(performance.now() - requestStartedAt),
        });
        reportFunnelcakeFallback({
          source: 'useInfiniteSearchVideos',
          apiUrl,
          reason: 'Funnelcake unavailable or circuit breaker open',
          dedupeKey: `useInfiniteSearchVideos:${searchParams.type}:${debouncedQuery}:unavailable`,
          context: {
            query: debouncedQuery,
            searchType: searchParams.type,
          },
        });
      } else {
        debugLog('[useInfiniteSearchVideos] Continuing relay pagination for search fallback', pageParam);
      }

      const filter: NIP50Filter = {
        kinds: VIDEO_KINDS,
        limit: pageSize,
      };

      if (searchParams.type === 'hashtag') {
        filter['#t'] = [searchParams.value];
        if (relayTimestamp) {
          filter.until = relayTimestamp;
        }

        const relayStartedAt = performance.now();
        const { events, videos } = await fetchChronologicalRelayPage({
          nostr,
          filter,
          pageSize,
          signal: abortSignal,
        });
        const relayCompletedAt = performance.now();
        const rawCursor = events.length > 0
          ? events[events.length - 1].created_at - 1
          : undefined;

        console.info('[search/videos] hashtag query complete', {
          ...requestContext,
          mode: 'nip50',
          relayMs: Math.round(relayCompletedAt - relayStartedAt),
          totalMs: Math.round(relayCompletedAt - requestStartedAt),
          eventCount: events.length,
          videoCount: videos.length,
        });

        return {
          videos,
          nextPageParam: videos.length > 0 && rawCursor !== undefined
            ? { type: 'relay-timestamp', until: rawCursor }
            : undefined,
        };
      }

      filter.search = sortMode === 'relevance'
        ? searchParams.value
        : `sort:${sortMode} ${searchParams.value}`;

      const relayStartedAt = performance.now();
      const { events, videos, requestedLimit } = await fetchRankedRelayPage({
        nostr,
        filter,
        pageSize,
        offset: relayOffset,
        signal: abortSignal,
      });
      const relayCompletedAt = performance.now();
      const nextOffset = nextSortedOffset(events.length, relayOffset);
      const hasMore = videos.length > 0 && sortedFeedHasMore(events.length, requestedLimit);

      console.info('[search/videos] relay query complete', {
        ...requestContext,
        mode: 'nip50',
        relayMs: Math.round(relayCompletedAt - relayStartedAt),
        totalMs: Math.round(relayCompletedAt - requestStartedAt),
        offset: relayOffset,
        requestedLimit,
        eventCount: events.length,
        videoCount: videos.length,
      });

      return {
        videos,
        nextPageParam: hasMore ? { type: 'relay-offset', offset: nextOffset } : undefined,
      };
    },
    getNextPageParam: lastPage => lastPage.nextPageParam,
    initialPageParam: undefined,
    enabled: !!debouncedQuery.trim() && !!nostr,
    staleTime: 60_000,
    gcTime: 300_000,
  });

  const fetchedCount = queryResult.data?.pages.reduce((sum, page) => sum + page.videos.length, 0) ?? 0;

  return {
    ...queryResult,
    fetchedCount,
  };
}
