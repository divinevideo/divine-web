// ABOUTME: Infinite scroll search hook for video events
// ABOUTME: Uses Funnelcake REST API for fast search, falls back to NIP-50 WebSocket

import { useInfiniteQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useState, useEffect } from 'react';
import { VIDEO_KINDS, type ParsedVideoData } from '@/types/video';
import type { NIP50Filter, SortMode } from '@/types/nostr';
import { parseVideoEvents } from '@/lib/videoParser';
import { searchVideos } from '@/lib/funnelcakeClient';
import { API_CONFIG } from '@/config/api';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { debugLog } from '@/lib/debug';
import { transformToVideoPage } from '@/lib/funnelcakeTransform';
import { reportFunnelcakeFallback } from '@/lib/funnelcakeFallbackReporting';

interface UseInfiniteSearchVideosOptions {
  query: string;
  searchType?: 'content' | 'author' | 'auto';
  sortMode?: SortMode | 'relevance';
  pageSize?: number;
}

interface VideoPage {
  videos: ParsedVideoData[];
  nextCursor: number | undefined;
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

export function useInfiniteSearchVideos({
  query,
  searchType = 'auto',
  sortMode = 'relevance',
  pageSize = 20,
}: UseInfiniteSearchVideosOptions) {
  const { nostr } = useNostr();
  const apiUrl = API_CONFIG.funnelcake.baseUrl;

  const isTest = process.env.NODE_ENV === 'test';
  const debounceMs = isTest ? 0 : 300;
  const debouncedQuery = useDebouncedValue(query, debounceMs);

  return useInfiniteQuery<VideoPage, Error>({
    queryKey: ['infinite-search-videos', debouncedQuery, searchType, sortMode, pageSize],
    queryFn: async ({ pageParam, signal }) => {
      if (!debouncedQuery.trim()) {
        return { videos: [], nextCursor: undefined };
      }

      const requestStartedAt = performance.now();
      const cursor = pageParam as number | undefined;
      const searchParams = parseSearchQuery(debouncedQuery, searchType);
      const requestContext = {
        query: debouncedQuery,
        parsedType: searchParams.type,
        parsedValue: searchParams.value,
        searchType,
        sortMode,
        cursor: cursor ?? null,
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

      if (isFunnelcakeAvailable(apiUrl)) {
        try {
          const funnelcakeSort = mapSearchSortModeToFunnelcakeSort(sortMode);

          if (searchParams.type === 'hashtag' || searchParams.type === 'content') {
            const apiStartedAt = performance.now();
            const result = await searchVideos(apiUrl, {
              query: searchParams.type === 'content' ? searchParams.value : undefined,
              tag: searchParams.type === 'hashtag' ? searchParams.value : undefined,
              sort: funnelcakeSort,
              limit: pageSize,
              offset: cursor,
              classic: sortMode === 'classic' ? true : undefined,
              platform: sortMode === 'classic' ? 'vine' : undefined,
              signal: abortSignal,
            });
            const page = transformToVideoPage(result, 'offset');
            const apiCompletedAt = performance.now();
            const nextCursor = page.offset ?? page.nextCursor;

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
              nextCursor,
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
              return { videos: [], nextCursor: undefined };
            }

            const filter: NIP50Filter = {
              kinds: VIDEO_KINDS,
              authors: pubkeys,
              limit: pageSize,
            };
            if (cursor) {
              filter.until = cursor;
            }

            const relayStartedAt = performance.now();
            const events = await nostr.query([filter], { signal: abortSignal });
            const videos = parseVideoEvents(events);
            const relayCompletedAt = performance.now();

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
              nextCursor: videos.length > 0 ? videos[videos.length - 1].createdAt - 1 : undefined,
            };
          }
        } catch (error) {
          console.warn('[search/videos] funnelcake query failed, falling back to relay search', {
            ...requestContext,
            error,
            totalMs: Math.round(performance.now() - requestStartedAt),
          });
          debugLog('[useInfiniteSearchVideos] Funnelcake search failed, falling back to NIP-50:', error);
          reportFunnelcakeFallback({
            source: 'useInfiniteSearchVideos',
            apiUrl,
            reason: error instanceof Error ? error.message : String(error),
            dedupeKey: `useInfiniteSearchVideos:${searchParams.type}:${debouncedQuery}`,
            context: {
              query: debouncedQuery,
              searchType: searchParams.type,
            },
          });
        }
      } else {
        console.warn('[search/videos] funnelcake unavailable, falling back to relay search', {
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
      }

      const filter: NIP50Filter = {
        kinds: VIDEO_KINDS,
        limit: pageSize,
      };

      if (cursor) {
        filter.until = cursor;
      }

      if (searchParams.type === 'hashtag') {
        filter['#t'] = [searchParams.value];

        const relayStartedAt = performance.now();
        const events = await nostr.query([filter], { signal: abortSignal });
        const videos = parseVideoEvents(events);
        const relayCompletedAt = performance.now();

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
          nextCursor: videos.length > 0 ? videos[videos.length - 1].createdAt - 1 : undefined,
        };
      }

      filter.search = sortMode === 'relevance'
        ? searchParams.value
        : `sort:${sortMode} ${searchParams.value}`;

      const relayStartedAt = performance.now();
      const events = await nostr.query([filter], { signal: abortSignal });
      const videos = parseVideoEvents(events);
      const relayCompletedAt = performance.now();

      console.info('[search/videos] relay query complete', {
        ...requestContext,
        mode: 'nip50',
        relayMs: Math.round(relayCompletedAt - relayStartedAt),
        totalMs: Math.round(relayCompletedAt - requestStartedAt),
        eventCount: events.length,
        videoCount: videos.length,
      });

      return {
        videos,
        nextCursor: videos.length > 0 ? videos[videos.length - 1].createdAt - 1 : undefined,
      };
    },
    getNextPageParam: lastPage => lastPage.nextCursor,
    initialPageParam: undefined,
    enabled: !!debouncedQuery.trim() && !!nostr,
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
