// ABOUTME: Hook for querying and managing video events from Nostr relays
// ABOUTME: Handles video events (kind 34236) and Kind 6 reposts with proper parsing
// ABOUTME: Supports auto-refresh for home and recent feeds matching Flutter app behavior

import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useFollowList } from '@/hooks/useFollowList';
import { useEffect } from 'react';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND, VIDEO_KINDS, REPOST_KIND, type ParsedVideoData } from '@/types/video';
import type { NIP50Filter } from '@/types/nostr';
import { parseVideoEvent, getVineId, getThumbnailUrl, getLoopCount, getOriginalVineTimestamp, getProofModeData, getOriginalLikeCount, getOriginalRepostCount, getOriginalCommentCount, getOriginPlatform, isVineMigrated, getLatestRepostTime, validateVideoEvent } from '@/lib/videoParser';
import { debugLog, debugError, verboseLog } from '@/lib/debug';
import type { SortMode } from '@/types/nostr';

interface UseVideoEventsOptions {
  filter?: Partial<NostrFilter>;
  feedType?: 'discovery' | 'home' | 'trending' | 'hashtag' | 'profile' | 'recent';
  hashtag?: string;
  pubkey?: string;
  limit?: number;
  until?: number; // For pagination - get videos before this timestamp
  sortMode?: SortMode; // NIP-50 sort mode override
}

/**
 * Get reaction counts for videos to determine trending
 */
async function getReactionCounts(
  nostr: { query: (filters: NostrFilter[], options: { signal: AbortSignal }) => Promise<NostrEvent[]> },
  videoIds: string[],
  since: number,
  signal: AbortSignal
): Promise<Record<string, number>> {
  if (videoIds.length === 0) return {};

  try {
    // Query for reactions (kind 7) and reposts (kind 6) to these videos
    const reactions = await nostr.query([{
      kinds: [6, 7], // Reposts and reactions
      '#e': videoIds,
      since, // Only count recent reactions
      limit: 100 // Optimized for performance
    }], { signal });

    // Count reactions per video
    const counts: Record<string, number> = {};
    reactions.forEach(reaction => {
      reaction.tags.forEach(tag => {
        if (tag[0] === 'e' && tag[1]) {
          counts[tag[1]] = (counts[tag[1]] || 0) + 1;
        }
      });
    });

    return counts;
  } catch {
    return {};
  }
}

/**
 * Parse video events and handle reposts with deduplication
 * NEW: Aggregates reposts by video ID instead of creating duplicate entries
 */
async function parseVideoEvents(
  events: NostrEvent[],
  nostr: { query: (filters: NostrFilter[], options: { signal: AbortSignal }) => Promise<NostrEvent[]> },
  sortChronologically = false
): Promise<ParsedVideoData[]> {
  // Map to store videos by their unique ID (vineId or event ID)
  const videoMap = new Map<string, ParsedVideoData>();

  // Separate videos and reposts
  const videoEvents = events.filter(e => VIDEO_KINDS.includes(e.kind));
  const repostEvents = events.filter(e => e.kind === REPOST_KIND);

  debugLog(`[useVideoEvents] Processing ${videoEvents.length} videos and ${repostEvents.length} reposts`);

  let validVideos = 0;
  let invalidVideos = 0;

  // Process direct video events - add to map by vineId
  for (const event of videoEvents) {
    if (!validateVideoEvent(event)) {
      invalidVideos++;
      continue;
    }

    const videoEvent = parseVideoEvent(event);
    if (!videoEvent) {
      invalidVideos++;
      continue;
    }

    // Get vineId from d tag (required for kind 34236)
    const vineId = getVineId(event)!;

    const videoUrl = videoEvent.videoMetadata?.url;
    if (!videoUrl) {
      debugError(`[useVideoEvents] No video URL in metadata for event ${event.id}:`, videoEvent.videoMetadata);
      invalidVideos++;
      continue;
    }

    validVideos++;

    // NEW: Use vineId as the unique key for deduplication
    const uniqueKey = vineId;

    // If we already have this video, skip (keep the first one)
    if (videoMap.has(uniqueKey)) {
      debugLog(`[useVideoEvents] Skipping duplicate video with vineId ${vineId}`);
      continue;
    }

    videoMap.set(uniqueKey, {
      id: event.id,
      pubkey: event.pubkey,
      kind: event.kind as typeof SHORT_VIDEO_KIND,
      createdAt: event.created_at,
      originalVineTimestamp: getOriginalVineTimestamp(event),
      content: event.content,
      videoUrl,
      fallbackVideoUrls: videoEvent.videoMetadata?.fallbackUrls,
      hlsUrl: videoEvent.videoMetadata?.hlsUrl,
      thumbnailUrl: getThumbnailUrl(videoEvent),
      blurhash: videoEvent.videoMetadata?.blurhash,
      title: videoEvent.title,
      duration: videoEvent.videoMetadata?.duration,
      hashtags: videoEvent.hashtags || [],
      vineId,
      loopCount: getLoopCount(event),
      likeCount: getOriginalLikeCount(event),
      repostCount: getOriginalRepostCount(event),
      commentCount: getOriginalCommentCount(event),
      proofMode: getProofModeData(event),
      origin: getOriginPlatform(event),
      isVineMigrated: isVineMigrated(event),
      reposts: [], // Initialize empty reposts array
      originalEvent: event // Store original event for source viewing
    });
  }

  debugLog(`[useVideoEvents] Parsed ${validVideos} valid videos (${videoMap.size} unique), ${invalidVideos} invalid`);

  // Process reposts - NEW: Aggregate as metadata instead of creating duplicates
  let repostsFetched = 0;
  let repostsSkipped = 0;
  let repostsAggregated = 0;

  for (const repost of repostEvents) {
    // Extract 'a' tag for addressable event reference
    const aTag = repost.tags.find(tag => tag[0] === 'a');
    if (!aTag?.[1]) {
      repostsSkipped++;
      continue;
    }

    // Parse addressable coordinate
    const [kind, pubkey, dTag] = aTag[1].split(':');
    const kindNum = parseInt(kind, 10);
    if (!VIDEO_KINDS.includes(kindNum) || !pubkey || !dTag) {
      repostsSkipped++;
      continue;
    }

    // The unique key is the vineId (dTag)
    const vineId = dTag;

    // Check if we already have this video in our map
    let videoData = videoMap.get(vineId);

    if (!videoData) {
      // Need to fetch the original video
      let originalVideo = videoEvents.find(e =>
        e.pubkey === pubkey && getVineId(e) === vineId
      );

      if (!originalVideo) {
        // Fetch from relay (10s timeout for gateway REST API)
        try {
          const signal = AbortSignal.timeout(10000);
          const events = await nostr.query([{
            kinds: VIDEO_KINDS,
            authors: [pubkey],
            '#d': [vineId],
            limit: 1
          }], { signal });

          originalVideo = events[0];
          repostsFetched++;
        } catch {
          repostsSkipped++;
          continue;
        }
      }

      if (!originalVideo || !validateVideoEvent(originalVideo)) {
        repostsSkipped++;
        continue;
      }

      const videoEvent = parseVideoEvent(originalVideo);
      if (!videoEvent) {
        repostsSkipped++;
        continue;
      }

      const videoUrl = videoEvent.videoMetadata?.url;
      if (!videoUrl) {
        debugError(`[useVideoEvents] No video URL in repost metadata for event ${originalVideo.id}:`, videoEvent.videoMetadata);
        repostsSkipped++;
        continue;
      }

      // Create new video entry
      videoData = {
        id: originalVideo.id,
        pubkey: originalVideo.pubkey,
        kind: SHORT_VIDEO_KIND,
        createdAt: originalVideo.created_at,
        originalVineTimestamp: getOriginalVineTimestamp(originalVideo),
        content: originalVideo.content,
        videoUrl,
        fallbackVideoUrls: videoEvent.videoMetadata?.fallbackUrls,
        hlsUrl: videoEvent.videoMetadata?.hlsUrl,
        thumbnailUrl: getThumbnailUrl(videoEvent),
        blurhash: videoEvent.videoMetadata?.blurhash,
        title: videoEvent.title,
        duration: videoEvent.videoMetadata?.duration,
        hashtags: videoEvent.hashtags || [],
        vineId,
        loopCount: getLoopCount(originalVideo),
        likeCount: getOriginalLikeCount(originalVideo),
        repostCount: getOriginalRepostCount(originalVideo),
        commentCount: getOriginalCommentCount(originalVideo),
        proofMode: getProofModeData(originalVideo),
        origin: getOriginPlatform(originalVideo),
        isVineMigrated: isVineMigrated(originalVideo),
        reposts: [],
        originalEvent: originalVideo // Store original event for source viewing
      };

      videoMap.set(vineId, videoData);
    }

    // Safety check (should never happen due to logic above)
    if (!videoData) {
      debugError(`[useVideoEvents] videoData unexpectedly undefined for vineId ${vineId}`);
      continue;
    }

    // Add repost metadata to the video
    videoData.reposts.push({
      eventId: repost.id,
      reposterPubkey: repost.pubkey,
      repostedAt: repost.created_at
    });

    repostsAggregated++;
  }

  debugLog(`[useVideoEvents] Processed reposts: ${repostsFetched} fetched, ${repostsAggregated} aggregated, ${repostsSkipped} skipped`);

  // Convert map to array
  const parsedVideos = Array.from(videoMap.values());

  // Sort videos based on mode
  if (sortChronologically) {
    // Sort by time only (most recent first) for chronological feeds
    // Use latest repost time if video has been reposted
    return parsedVideos.sort((a, b) => {
      const timeA = a.reposts.length > 0
        ? Math.max(...a.reposts.map(r => r.repostedAt), a.createdAt)
        : a.createdAt;
      const timeB = b.reposts.length > 0
        ? Math.max(...b.reposts.map(r => r.repostedAt), b.createdAt)
        : b.createdAt;
      return timeB - timeA;
    });
  } else {
    // Sort by loop count (highest first), then by created_at for ties
    return parsedVideos.sort((a, b) => {
      // First sort by loop count
      const loopDiff = (b.loopCount || 0) - (a.loopCount || 0);
      if (loopDiff !== 0) return loopDiff;

      // Then by time for ties (use latest repost time if available)
      const timeA = a.reposts.length > 0
        ? Math.max(...a.reposts.map(r => r.repostedAt), a.createdAt)
        : a.createdAt;
      const timeB = b.reposts.length > 0
        ? Math.max(...b.reposts.map(r => r.repostedAt), b.createdAt)
        : b.createdAt;
      return timeB - timeA;
    });
  }
}

/**
 * Hook to fetch video events with auto-refresh support
 */
export function useVideoEvents(options: UseVideoEventsOptions = {}) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { filter, feedType = 'discovery', hashtag, pubkey, limit = 50, until, sortMode } = options;

  // Get follow list for home feed - this is cached and auto-refetches
  const { data: followList } = useFollowList();

  const queryResult = useQuery({
    queryKey: ['video-events', feedType, hashtag, pubkey, limit, until, sortMode, user?.pubkey, followList, filter],
    queryFn: async (context) => {
      const startTime = performance.now();
      verboseLog(`[useVideoEvents] ========== Starting query for ${feedType} feed ==========`);
      verboseLog(`[useVideoEvents] Options:`, { feedType, hashtag, pubkey, limit, until });

      // Timeouts need to accommodate gateway REST API calls which are slower than direct WebSocket
      // Gateway calls go through CDN and may take longer on first request
      const timeoutMs = feedType === 'hashtag' ? 15000 : (until ? 15000 : 10000);
      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(timeoutMs) // 15s for hashtags/pagination, 10s for initial load
      ]);

      // Build base filter with NIP-50 support
      // Profile feeds: no limit (get all videos for accurate stats)
      // Other feeds: cap at 50 per query (they use pagination/infinite scroll)
      const baseFilter: NIP50Filter = {
        kinds: VIDEO_KINDS,
        ...(feedType === 'profile' 
          ? {} // No limit for profiles
          : { limit: Math.min(limit, 50) } // Cap at 50 for other feeds
        ),
        ...filter
      };

      // If filtering by specific IDs, ensure we query them directly
      const isDirectIdLookup = filter?.ids && filter.ids.length > 0;
      if (isDirectIdLookup && filter.ids) {
        // For direct ID lookups, remove limit restriction
        baseFilter.limit = filter.ids.length;
        debugLog('[useVideoEvents] Direct ID lookup mode:', filter.ids);
      }

      // Add NIP-50 search with sort mode for feeds that should sort by popularity
      // But NOT for direct ID lookups - those should just fetch the specific event
      // NOTE: hashtag feeds excluded - relay doesn't support combining #t filter with search parameter
      const shouldSortByPopularity = ['trending', 'home', 'discovery'].includes(feedType) && !isDirectIdLookup;
      if (shouldSortByPopularity) {
        // Use explicit sortMode if provided, otherwise auto-select based on feedType
        // Explicit sortMode allows UI to control sorting (e.g., hot/top/rising/controversial selector)
        const effectiveSortMode = sortMode || (feedType === 'trending' ? 'hot' : 'top');
        baseFilter.search = `sort:${effectiveSortMode}`;
        debugLog(`[useVideoEvents] Using NIP-50 sort:${effectiveSortMode} for ${feedType} feed`);
      }

      // Add pagination
      if (until) {
        baseFilter.until = until;
      }

      // For 'recent' feed, remove the since filter to get all videos
      // The relay will sort by created_at naturally
      // Note: Removed 30-day restriction to show all recent videos
      if (feedType === 'recent' && !until) {
        // Don't add since filter - just get recent videos sorted by time
      }

      // Handle different feed types
      if (feedType === 'hashtag' && hashtag) {
        baseFilter['#t'] = [hashtag.toLowerCase()];
        baseFilter.limit = limit;
      } else if (feedType === 'profile' && pubkey) {
        baseFilter.authors = [pubkey];
      } else if (feedType === 'home' && user?.pubkey) {
        // Use cached follow list from useFollowList hook
        debugLog(`[useVideoEvents] Using follow list from cache/hook`);
        if (!followList || followList.length === 0) {
          debugLog(`[useVideoEvents] WARNING: User has no follows, returning empty feed`);
          return [];
        }
        debugLog(`[useVideoEvents] Follow list: ${followList.length} follows`);
        debugLog(`[useVideoEvents] Following: ${followList.slice(0, 5).join(', ')}${followList.length > 5 ? '...' : ''}`);
        baseFilter.authors = followList;
      } else if (feedType === 'trending') {
        // Start with a small query for fast initial load, then fetch more later
        baseFilter.limit = until ? Math.max(limit * 3, 150) : 20;
      }

      let events: NostrEvent[] = [];
      let repostEvents: NostrEvent[] = [];

      try {
        // Query videos first
        const queryStartTime = performance.now();
        console.log('[useVideoEvents] Sending query with filter:', JSON.stringify(baseFilter, null, 2));
        verboseLog('[useVideoEvents] Calling nostr.query...');
        events = await nostr.query([baseFilter], { signal });
        console.log(`[useVideoEvents] Video query took ${(performance.now() - queryStartTime).toFixed(0)}ms, got ${events.length} events`);
        if (events.length > 0) {
          console.log('[useVideoEvents] First event:', events[0]);
        }

        // Log if we got zero events for debugging
        if (events.length === 0) {
          console.warn('[useVideoEvents] WARNING: Query returned 0 events');
          console.log('[useVideoEvents] Filter used:', JSON.stringify(baseFilter));
          console.log('[useVideoEvents] feedType:', feedType);
          console.log('[useVideoEvents] isDirectIdLookup:', isDirectIdLookup);
          console.log('[useVideoEvents] This could indicate a relay issue or no matching content');
        }

        // Only query reposts if we don't have enough videos and NOT doing a direct ID lookup
        // Skip repost queries when using NIP-50 sorting (relay handles it efficiently)
        if (events.length < limit && feedType !== 'profile' && !isDirectIdLookup && !shouldSortByPopularity) {
          const repostFilter = { ...baseFilter, kinds: [REPOST_KIND], limit: 15 }; // Optimized for performance
          const repostStartTime = performance.now();
          repostEvents = await nostr.query([repostFilter], { signal });
          debugLog(`[useVideoEvents] Repost query took ${(performance.now() - repostStartTime).toFixed(0)}ms, got ${repostEvents.length} events`);
          events = [...events, ...repostEvents];
        } else if (isDirectIdLookup) {
          debugLog('[useVideoEvents] Skipping repost query for direct ID lookup');
        } else if (shouldSortByPopularity) {
          debugLog('[useVideoEvents] Skipping repost query (using NIP-50 sorting)');
        }
      } catch (err) {
        debugError('[useVideoEvents] Query error:', err);
        debugError('[useVideoEvents] Filter that caused error:', JSON.stringify(baseFilter));
        debugError('[useVideoEvents] This likely indicates a relay connectivity issue');
        throw err;
      }

      const parseStartTime = performance.now();
      // Use chronological sorting for 'recent' feedType
      const sortChronologically = feedType === 'recent';
      let parsed = await parseVideoEvents(events, nostr, sortChronologically);
      const parseTime = performance.now() - parseStartTime;
      debugLog(`[useVideoEvents] Parse took ${parseTime.toFixed(0)}ms`);

      // Note: Removed inefficient hashtag fallback - relay now handles hashtag filtering
      // via server-side tag queries with NIP-50 search for optimal performance

      // Trust relay sorting when using NIP-50 search (sort:hot, sort:top)
      // Only apply client-side sorting for feeds without NIP-50
      // This dramatically improves performance by eliminating redundant reaction queries
      if (!shouldSortByPopularity && (feedType === 'trending' || feedType === 'hashtag' || feedType === 'home') && parsed.length > 0) {
        // Fallback client-side sorting only when relay doesn't support NIP-50
        debugLog('[useVideoEvents] Applying client-side sorting (relay does not support NIP-50)');
        const since = 0;
        const videoIds = parsed.map(v => v.id);
        const reactionCounts = await getReactionCounts(nostr, videoIds, since, signal);

        parsed = parsed
          .map(video => ({
            ...video,
            reactionCount: reactionCounts[video.id] || 0,
            totalEngagement: (video.loopCount || 0) + (reactionCounts[video.id] || 0)
          }))
          .sort((a, b) => {
            if (a.totalEngagement !== b.totalEngagement) {
              return b.totalEngagement - a.totalEngagement;
            }
            const timeA = getLatestRepostTime(a);
            const timeB = getLatestRepostTime(b);
            return timeB - timeA;
          })
          .slice(0, limit);
      }

      const totalTime = performance.now() - startTime;
      debugLog(`[useVideoEvents] Total query time: ${totalTime.toFixed(0)}ms, returning ${parsed.length} videos`);

      // Emit performance metrics
      if (typeof window !== 'undefined') {
        const metrics = {
          queryTime: Math.round(totalTime),
          parseTime: Math.round(parseTime),
          totalEvents: events.length,
          validVideos: parsed.length,
        };
        debugLog('[useVideoEvents] Emitting metrics:', metrics);
        window.dispatchEvent(new CustomEvent('performance-metric', {
          detail: metrics
        }));
      }

      return parsed;
    },
    staleTime: 300000, // 5 minutes - reduce re-queries for better performance
    gcTime: 900000, // 15 minutes - keep data longer in cache
    enabled: (feedType !== 'home' || !!user?.pubkey) && (feedType !== 'profile' || !!pubkey), // Only run home feed if user is logged in, and profile feed if pubkey is provided
  });

  // Auto-refresh logic matching Flutter app behavior
  useEffect(() => {
    if (!queryResult.data) return; // Don't start refresh until initial load

    let intervalId: NodeJS.Timeout | null = null;

    // Set up auto-refresh based on feed type
    if (feedType === 'home') {
      // Home feed: Refresh every 10 minutes (matching Flutter)
      intervalId = setInterval(() => {
        debugLog('[useVideoEvents] Auto-refreshing home feed (10 min interval)');
        queryResult.refetch();
      }, 10 * 60 * 1000); // 10 minutes
    } else if (feedType === 'recent') {
      // Recent feed: Refresh every 30 seconds (matching Flutter)
      intervalId = setInterval(() => {
        debugLog('[useVideoEvents] Auto-refreshing recent feed (30 sec interval)');
        queryResult.refetch();
      }, 30 * 1000); // 30 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [feedType, queryResult.data, queryResult.refetch]);

  return queryResult;
}
