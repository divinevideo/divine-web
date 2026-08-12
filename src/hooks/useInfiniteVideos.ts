// ABOUTME: Infinite scroll hook for video feeds with cursor-based pagination
// ABOUTME: Uses NIP-50 search for sorting and supports all feed types

import { useInfiniteQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useFollowList } from '@/hooks/useFollowList';
import { useAppContext } from '@/hooks/useAppContext';
import { useVideoSortSupport } from '@/hooks/useRelayCapabilities';
import { VIDEO_KINDS, type ParsedVideoData } from '@/types/video';
import type { NIP50Filter, SortMode } from '@/types/nostr';
import { parseVideoEvents } from '@/lib/videoParser';
import { debugLog } from '@/lib/debug';
import { performanceMonitor } from '@/lib/performanceMonitoring';
import {
  nextSortedOffset,
  RAW_FEED_BACKFILL_ATTEMPTS,
  sortedFeedHasMore,
  sortedFeedWindowSize,
} from '@/lib/sortedFeedWindow';

interface UseInfiniteVideosOptions {
  feedType: 'discovery' | 'home' | 'trending' | 'hashtag' | 'profile' | 'recent';
  hashtag?: string;
  pubkey?: string;
  pageSize?: number;
  sortMode?: SortMode;
  enabled?: boolean;
}

interface VideoPage {
  videos: ParsedVideoData[];
  nextCursor: number | undefined;
  // For offset-based pagination with sorted feeds
  offset?: number;
}

/**
 * Infinite scroll hook for video feeds
 * Uses cursor-based pagination with NIP-50 search
 */
export function useInfiniteVideos({
  feedType,
  hashtag,
  pubkey,
  pageSize = 20,
  sortMode,
  enabled = true
}: UseInfiniteVideosOptions) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: followList, isLoading: isLoadingFollows } = useFollowList();
  const { config } = useAppContext();
  const supportsVideoSorts = useVideoSortSupport();

  // Auto-determine sort mode ONLY for trending/discovery feeds
  // Home feed should always be chronological unless explicitly sorted
  let requestedSortMode = sortMode;
  if (!sortMode && feedType === 'trending') {
    requestedSortMode = 'hot';
  }

  // Only use relay-side sort when the relay has proven it works for video events.
  const effectiveSortMode = (supportsVideoSorts && requestedSortMode) ? requestedSortMode : undefined;

  if (!supportsVideoSorts && requestedSortMode) {
    debugLog(`[useInfiniteVideos] Relay doesn't support video sorting, will use chronological order instead of sort:${requestedSortMode}`);
  }

  return useInfiniteQuery<VideoPage, Error>({
    queryKey: ['infinite-videos', feedType, hashtag, pubkey, requestedSortMode, effectiveSortMode, pageSize],
    queryFn: async ({ pageParam, signal }) => {
      const totalStart = performance.now();

      // For sorted feeds, pageParam is { offset: number }
      // For chronological feeds, pageParam is a timestamp cursor
      const isOffsetParam = typeof pageParam === 'object' && pageParam !== null && 'offset' in pageParam;
      const offset = isOffsetParam ? (pageParam as { offset: number }).offset : 0;
      const cursor = !isOffsetParam ? (pageParam as number | undefined) : undefined;

      const useSortedPagination = !!(effectiveSortMode && ['top', 'hot', 'rising', 'controversial'].includes(effectiveSortMode));

      // Build filter based on feed type. Sorted relay pagination uses a
      // growing prefix because NIP-50 has no offset parameter. That means
      // relay traffic grows with depth and will stop at the relay's limit cap.
      const filter: NIP50Filter = {
        kinds: VIDEO_KINDS,
        limit: useSortedPagination ? offset + pageSize : pageSize
      };

      if (useSortedPagination) {
        debugLog(`[useInfiniteVideos] Sorted pagination: requesting ${filter.limit} to get offset ${offset}`);
      } else if (cursor) {
        // Use timestamp cursor for chronological pagination
        filter.until = cursor;
      }

      // Filter for Classic (archived Vines) - trending feed with top sort
      if (effectiveSortMode === 'top' && feedType === 'trending') {
        filter['#platform'] = ['vine'];
        debugLog('[useInfiniteVideos] 🎬 Classic mode: filtering for archived Vines only');
      }

      // Configure based on feed type
      switch (feedType) {
        case 'hashtag':
          if (!hashtag) throw new Error('Hashtag required for hashtag feed');
          filter['#t'] = [hashtag.toLowerCase()];
          // NOTE: Do NOT add NIP-50 search parameter with #t filter
          // The relay doesn't support combining tag queries with search - returns 0 results
          // Sort will be applied client-side after fetching
          break;

        case 'profile':
          if (!pubkey) throw new Error('Pubkey required for profile feed');
          filter.authors = [pubkey];
          break;

        case 'home':
          if (!user?.pubkey) {
            debugLog('[useInfiniteVideos] No user logged in for home feed');
            return { videos: [], nextCursor: undefined };
          }
          if (isLoadingFollows) {
            debugLog('[useInfiniteVideos] Still loading follow list, waiting...');
            return { videos: [], nextCursor: undefined };
          }
          if (!followList || followList.length === 0) {
            debugLog('[useInfiniteVideos] User has no follows, returning empty feed');
            return { videos: [], nextCursor: undefined };
          }
          debugLog(`[useInfiniteVideos] Home feed: user ${user.pubkey} following ${followList.length} accounts`);
          debugLog(`[useInfiniteVideos] First 5 follows:`, followList.slice(0, 5));
          filter.authors = followList;
          // Only add search if relay supports NIP-50
          if (effectiveSortMode) {
            filter.search = `sort:${effectiveSortMode}`;
          }
          break;

        case 'trending':
          // Only add search if relay supports NIP-50
          // NOTE: Do NOT add NIP-50 search with #platform filter for Classic (top) mode
          // The relay doesn't support combining tag queries with search - returns wrong results
          // Classic Vines are sorted client-side by loop count instead
          if (effectiveSortMode && effectiveSortMode !== 'top') {
            debugLog(`[useInfiniteVideos] 🔥 Trending feed with sort mode: ${effectiveSortMode}`);
            filter.search = `sort:${effectiveSortMode}`;
          } else if (effectiveSortMode === 'top') {
            debugLog('[useInfiniteVideos] 🎬 Classic mode: using #platform filter, no NIP-50 search (will sort by loop count client-side)');
          } else {
            debugLog('[useInfiniteVideos] ⚠️ Trending feed WITHOUT sort mode (relay may not support NIP-50)');
          }
          break;

        case 'discovery':
          // Only add search if relay supports NIP-50 and a sort mode is provided
          if (effectiveSortMode) {
            debugLog(`[useInfiniteVideos] 🔍 Discovery feed with sort mode: ${effectiveSortMode}`);
            filter.search = `sort:${effectiveSortMode}`;
          } else {
            debugLog('[useInfiniteVideos] ⚠️ Discovery feed in chronological order (no sort mode)');
          }
          break;

        case 'recent':
          // Explicitly request chronological order (no sort parameter)
          // NIP-50 relays should return events in reverse chronological order by default
          // when no search/sort is specified
          debugLog('[useInfiniteVideos] 🕐 Recent feed - requesting chronological order (no sort)');
          break;
      }

      debugLog(`[useInfiniteVideos] 📡 Fetching ${feedType} feed, cursor: ${cursor || 'none'}, sort: ${effectiveSortMode || 'none'}, filter:`, filter);

      let events: Awaited<ReturnType<typeof nostr.query>> = [];
      let pageVideos: ParsedVideoData[] = [];
      let queryTime = 0;
      let parseTime = 0;
      let requestedLimit = pageSize;

      for (let attempt = 0; attempt < RAW_FEED_BACKFILL_ATTEMPTS; attempt++) {
        if (useSortedPagination) {
          requestedLimit = offset + sortedFeedWindowSize(pageSize, attempt);
          filter.limit = requestedLimit;
        } else {
          requestedLimit = pageSize;
          filter.limit = requestedLimit;
        }

        const queryFilter = { ...filter };
        const queryStart = performance.now();
        events = await nostr.query([queryFilter], {
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(10000)
          ])
        });
        const attemptQueryTime = performance.now() - queryStart;
        queryTime += attemptQueryTime;

        performanceMonitor.recordQuery({
          relayUrl: config.relayUrl,
          queryType: `infinite-${feedType}`,
          duration: attemptQueryTime,
          eventCount: events.length,
          filters: JSON.stringify(queryFilter)
        });

        debugLog(`[useInfiniteVideos] Got ${events.length} events for ${feedType} in ${attemptQueryTime.toFixed(0)}ms`);

        if (events.length > 0) {
          debugLog(`[useInfiniteVideos] First 3 events timestamps:`,
            events.slice(0, 3).map(e => ({
              created_at: e.created_at,
              date: new Date(e.created_at * 1000).toISOString(),
              id: e.id.substring(0, 8)
            }))
          );
        }

        const parseStart = performance.now();
        const eventsToParse = useSortedPagination ? events.slice(offset) : events;
        let videos = parseVideoEvents(eventsToParse);

        // Sort Classic Vines by loop count (original Vine popularity metric)
        // NIP-50's 'top' sort uses Nostr engagement, not original Vine loops
        if (effectiveSortMode === 'top' && feedType === 'trending') {
          videos = videos.sort((a, b) => {
            const aLoops = a.loopCount || 0;
            const bLoops = b.loopCount || 0;
            return bLoops - aLoops; // Descending order (most loops first)
          });
          debugLog(`[useInfiniteVideos] 🔄 Sorted ${videos.length} Classic Vines by loop count`);
        }

        // Client-side sorting for hashtag feeds (relay doesn't support #t + search combo)
        if (feedType === 'hashtag' && sortMode && videos.length > 1) {
          debugLog(`[useInfiniteVideos] 🔄 Applying client-side sort:${sortMode} for hashtag feed`);
          videos = videos.sort((a, b) => {
            switch (sortMode) {
              case 'top':
                // Sort by loop count (popularity)
                return (b.loopCount || 0) - (a.loopCount || 0);
              case 'hot': {
                // Hot = engagement weighted by recency (loop count + time decay)
                const aScore = (a.loopCount || 0) / Math.pow((Date.now() / 1000 - a.createdAt) / 3600 + 1, 1.5);
                const bScore = (b.loopCount || 0) / Math.pow((Date.now() / 1000 - b.createdAt) / 3600 + 1, 1.5);
                return bScore - aScore;
              }
              case 'rising': {
                // Rising = recent with some engagement
                const aRising = (a.loopCount || 0) * Math.max(0, 1 - (Date.now() / 1000 - a.createdAt) / 86400);
                const bRising = (b.loopCount || 0) * Math.max(0, 1 - (Date.now() / 1000 - b.createdAt) / 86400);
                return bRising - aRising;
              }
              default:
                // Default: chronological (newest first)
                return b.createdAt - a.createdAt;
            }
          });
        }

        parseTime += performance.now() - parseStart;
        pageVideos = videos;

        if (pageVideos.length > 0 || events.length < requestedLimit) {
          break;
        }

        if (useSortedPagination) {
          debugLog(`[useInfiniteVideos] Sorted page at offset ${offset} parsed empty; expanding raw window`);
          continue;
        }

        const lastEvent = events[events.length - 1];
        if (!lastEvent) {
          break;
        }
        filter.until = lastEvent.created_at - 1;
        debugLog(`[useInfiniteVideos] Chronological page parsed empty; advancing raw cursor to ${filter.until}`);
      }

      if (useSortedPagination) {
        debugLog(`[useInfiniteVideos] Sliced sorted raw results: ${events.length} total -> ${pageVideos.length} parsed for page (offset ${offset})`);
      }

      const totalTime = performance.now() - totalStart;

      // Record feed load timing for this page
      performanceMonitor.recordFeedLoad({
        feedType,
        queryTime,
        parseTime,
        totalTime,
        videoCount: pageVideos.length,
        sortMode: effectiveSortMode,
      });

      // Determine next cursor/offset
      if (useSortedPagination) {
        // For sorted feeds, advance by raw events consumed, not parsed videos.
        const newOffset = nextSortedOffset(events.length, offset);
        const hasMore = pageVideos.length > 0 && sortedFeedHasMore(events.length, requestedLimit);
        debugLog(`[useInfiniteVideos] Sorted pagination: offset ${offset} -> ${newOffset}, hasMore: ${hasMore}`);
        return {
          videos: pageVideos,
          nextCursor: undefined,
          offset: hasMore ? newOffset : undefined
        };
      } else {
        // For chronological feeds, use timestamp cursor. Advancing by the last
        // raw event's timestamp (not the last parsed video's) is what unsticks
        // pagination when a full page parses short. This relies on nostr.query
        // returning non-search results newest-first: NPool sorts non-search
        // filters by created_at desc and video feeds bypass the profile/contact
        // cache, so events[last] is the oldest event fetched.
        const rawCursor = events.length > 0
          ? events[events.length - 1].created_at - 1
          : undefined;
        const nextCursor = pageVideos.length > 0 ? rawCursor : undefined;
        return {
          videos: pageVideos,
          nextCursor
        };
      }
    },
    getNextPageParam: (lastPage) => {
      // Use offset for sorted pagination, timestamp for chronological
      if (lastPage.offset !== undefined) {
        return { offset: lastPage.offset };
      }
      return lastPage.nextCursor;
    },
    initialPageParam: undefined,
    enabled: enabled && !!nostr && (feedType !== 'home' || (!!user?.pubkey && !isLoadingFollows)),
    staleTime: 60000, // 1 minute
    gcTime: 600000, // 10 minutes
  });
}
