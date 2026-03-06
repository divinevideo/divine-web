// ABOUTME: Infinite scroll search hook for video events
// ABOUTME: Uses Funnelcake REST API for fast search, falls back to NIP-50 WebSocket

import { useInfiniteQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useState, useEffect } from 'react';
import { VIDEO_KINDS, type ParsedVideoData } from '@/types/video';
import type { NIP50Filter, SortMode } from '@/types/nostr';
import { parseVideoEvents } from '@/lib/videoParser';
import { searchVideos } from '@/lib/funnelcakeClient';
import { DEFAULT_FUNNELCAKE_URL } from '@/config/relays';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { debugLog } from '@/lib/debug';
import { reportFunnelcakeFallback } from '@/lib/funnelcakeFallbackReporting';

interface UseInfiniteSearchVideosOptions {
  query: string;
  searchType?: 'content' | 'author' | 'auto';
  sortMode?: SortMode | 'relevance';
  pageSize?: number;
}

interface VideoPage {
  videos: ParsedVideoData[];
  nextCursor: number | string | undefined;
}

/**
 * Proper debounce hook
 */
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

/**
 * Parse search query to determine type
 */
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

  // Auto detection
  if (trimmedQuery.startsWith('#')) {
    return { type: 'hashtag', value: trimmedQuery.slice(1).toLowerCase() };
  }

  return { type: 'content', value: trimmedQuery };
}

/**
 * Infinite scroll search hook
 * Prefers Funnelcake REST API, falls back to NIP-50 WebSocket
 */
export function useInfiniteSearchVideos({
  query,
  searchType = 'auto',
  sortMode = 'relevance',
  pageSize = 20
}: UseInfiniteSearchVideosOptions) {
  const { nostr } = useNostr();

  const isTest = process.env.NODE_ENV === 'test';
  const debouncedQuery = useDebouncedValue(query, isTest ? 0 : 300);

  return useInfiniteQuery<VideoPage, Error>({
    queryKey: ['infinite-search-videos', debouncedQuery, searchType, sortMode, pageSize],
    queryFn: async ({ pageParam, signal }) => {
      if (!debouncedQuery.trim()) {
        return { videos: [], nextCursor: undefined };
      }

      const cursor = pageParam as number | string | undefined;
      const searchParams = parseSearchQuery(debouncedQuery, searchType);

      const abortSignal = AbortSignal.any([
        signal,
        AbortSignal.timeout(8000)
      ]);

      // Try Funnelcake REST API first (fast, ranked results)
      if (isFunnelcakeAvailable(DEFAULT_FUNNELCAKE_URL)) {
        try {
          // Map NIP-50 sort modes to Funnelcake sort options
          const sortMap: Record<string, 'trending' | 'recent' | 'popular'> = {
            relevance: 'trending',
            hot: 'trending',
            top: 'popular',
            rising: 'trending',
            controversial: 'trending',
            classic: 'trending',
          };
          const funnelcakeSort = sortMap[sortMode] || 'trending';

          if (searchParams.type === 'hashtag') {
            const result = await searchVideos(DEFAULT_FUNNELCAKE_URL, {
              tag: searchParams.value,
              sort: funnelcakeSort,
              limit: pageSize,
              offset: typeof cursor === 'string' ? parseInt(cursor, 10) : cursor as number | undefined,
              signal: abortSignal,
            });

            const videos = parseVideoEvents(result.videos as unknown as import('@nostrify/nostrify').NostrEvent[]);
            return {
              videos,
              nextCursor: result.next_cursor,
            };
          }

          if (searchParams.type === 'content') {
            const result = await searchVideos(DEFAULT_FUNNELCAKE_URL, {
              query: searchParams.value,
              sort: funnelcakeSort,
              limit: pageSize,
              offset: typeof cursor === 'string' ? parseInt(cursor, 10) : cursor as number | undefined,
              signal: abortSignal,
            });

            const videos = parseVideoEvents(result.videos as unknown as import('@nostrify/nostrify').NostrEvent[]);
            return {
              videos,
              nextCursor: result.next_cursor,
            };
          }

          // Author search: use Funnelcake profile search + video fetch
          if (searchParams.type === 'author') {
            const { searchProfiles } = await import('@/lib/funnelcakeClient');
            const profiles = await searchProfiles(DEFAULT_FUNNELCAKE_URL, searchParams.value, 10, abortSignal);
            const pubkeys = profiles.map(p => p.pubkey);

            if (pubkeys.length === 0) {
              return { videos: [], nextCursor: undefined };
            }

            // Fetch videos from matched authors via WebSocket (Funnelcake doesn't have multi-author video search)
            const filter: NIP50Filter = {
              kinds: VIDEO_KINDS,
              authors: pubkeys,
              limit: pageSize,
            };
            if (cursor) {
              filter.until = typeof cursor === 'string' ? parseInt(cursor, 10) : cursor;
            }

            const events = await nostr.query([filter], { signal: abortSignal });
            const videos = parseVideoEvents(events);
            return {
              videos,
              nextCursor: videos.length > 0 ? videos[videos.length - 1].createdAt - 1 : undefined,
            };
          }
        } catch (error) {
          debugLog('[useInfiniteSearchVideos] Funnelcake search failed, falling back to NIP-50:', error);
          reportFunnelcakeFallback({
            source: 'useInfiniteSearchVideos',
            apiUrl: DEFAULT_FUNNELCAKE_URL,
            reason: error instanceof Error ? error.message : String(error),
            dedupeKey: `useInfiniteSearchVideos:${searchParams.type}:${debouncedQuery}`,
            context: {
              query: debouncedQuery,
              searchType: searchParams.type,
            },
          });
        }
      } else {
        reportFunnelcakeFallback({
          source: 'useInfiniteSearchVideos',
          apiUrl: DEFAULT_FUNNELCAKE_URL,
          reason: 'Funnelcake unavailable or circuit breaker open',
          dedupeKey: `useInfiniteSearchVideos:${searchParams.type}:${debouncedQuery}:unavailable`,
          context: {
            query: debouncedQuery,
            searchType: searchParams.type,
          },
        });
      }

      // Fallback: NIP-50 WebSocket search
      const filter: NIP50Filter = {
        kinds: VIDEO_KINDS,
        limit: pageSize,
      };

      if (cursor) {
        filter.until = typeof cursor === 'string' ? parseInt(cursor, 10) : cursor;
      }

      if (searchParams.type === 'hashtag') {
        filter['#t'] = [searchParams.value];
      } else {
        filter.search = sortMode === 'relevance'
          ? searchParams.value
          : `sort:${sortMode} ${searchParams.value}`;
      }

      const events = await nostr.query([filter], { signal: abortSignal });
      const videos = parseVideoEvents(events);

      return {
        videos,
        nextCursor: videos.length > 0 ? videos[videos.length - 1].createdAt - 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined,
    enabled: !!debouncedQuery.trim() && !!nostr,
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
