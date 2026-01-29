// ABOUTME: Transform Funnelcake API responses to ParsedVideoData format
// ABOUTME: Bridges the gap between REST API data and existing video display components

import { parseByteArrayId } from './funnelcakeClient';
import { SHORT_VIDEO_KIND, type ParsedVideoData } from '@/types/video';
import type { FunnelcakeVideoRaw, FunnelcakeResponse } from '@/types/funnelcake';
import { debugLog } from './debug';

/**
 * Parse loop count from video content text
 * Vine videos often have "Original stats: X loops" embedded in the content
 */
function parseLoopsFromContent(content?: string): number | null {
  if (!content) return null;

  // Match patterns like "2,965,624 loops" or "2965624 loops"
  const match = content.match(/([0-9,]+)\s*loops/i);
  if (match) {
    // Remove commas and parse as integer
    const loops = parseInt(match[1].replace(/,/g, ''), 10);
    if (!isNaN(loops) && loops > 0) {
      return loops;
    }
  }
  return null;
}

/**
 * Transform a single Funnelcake video to ParsedVideoData format
 */
export function transformFunnelcakeVideo(raw: FunnelcakeVideoRaw): ParsedVideoData {
  // Handle byte array conversion for id and pubkey
  const id = Array.isArray(raw.id) ? parseByteArrayId(raw.id) : String(raw.id);
  const pubkey = Array.isArray(raw.pubkey) ? parseByteArrayId(raw.pubkey) : String(raw.pubkey);

  // Extract hashtags from title/content (if not already parsed by Funnelcake)
  // Funnelcake might not return hashtags separately, extract from title if needed
  const hashtags: string[] = [];
  if (raw.title) {
    const matches = raw.title.match(/#(\w+)/g);
    if (matches) {
      hashtags.push(...matches.map(tag => tag.slice(1).toLowerCase()));
    }
  }

  // Determine if this is a Vine migration based on platform or classic flag
  const isVineMigrated = raw.platform === 'vine' || raw.classic === true;

  const video: ParsedVideoData = {
    id,
    pubkey,
    authorName: raw.author_name, // Cached author name from Funnelcake
    authorAvatar: raw.author_avatar, // Cached author avatar from Funnelcake
    kind: SHORT_VIDEO_KIND,
    createdAt: raw.created_at,
    content: raw.title || '', // Funnelcake uses title field for content
    videoUrl: raw.video_url,
    thumbnailUrl: raw.thumbnail,
    blurhash: raw.blurhash,
    title: raw.title,
    dimensions: raw.dim, // Video dimensions from API (e.g., "1080x1920")
    hashtags,

    // Vine-specific fields
    vineId: raw.d_tag || null, // d_tag is the unique identifier
    // loops may come from API or be parsed from content text (for user videos endpoint)
    loopCount: raw.loops ?? parseLoopsFromContent(raw.content) ?? parseLoopsFromContent(raw.title) ?? 0,

    // Social metrics from Funnelcake (pre-computed)
    // Handle both naming conventions: embedded_* (main videos) vs plain (user videos)
    likeCount: raw.embedded_likes ?? raw.reactions ?? 0,
    repostCount: raw.embedded_reposts ?? raw.reposts ?? 0,
    commentCount: raw.embedded_comments ?? raw.comments ?? 0,

    // Origin data for Vine migrations
    isVineMigrated,
    origin: isVineMigrated ? {
      platform: 'vine',
      externalId: raw.d_tag || '',
    } : undefined,

    // Empty reposts array (Funnelcake doesn't return individual reposts)
    reposts: [],

    // No original event from REST API
    originalEvent: undefined,
  };

  return video;
}

/**
 * Transform a Funnelcake API response to an array of ParsedVideoData
 */
export function transformFunnelcakeResponse(response: FunnelcakeResponse): ParsedVideoData[] {
  if (!response.videos || !Array.isArray(response.videos)) {
    debugLog('[FunnelcakeTransform] No videos in response');
    return [];
  }

  const videos = response.videos
    .map(raw => {
      try {
        return transformFunnelcakeVideo(raw);
      } catch (err) {
        debugLog('[FunnelcakeTransform] Failed to transform video:', err, raw);
        return null;
      }
    })
    .filter((v): v is ParsedVideoData => v !== null);

  debugLog(`[FunnelcakeTransform] Transformed ${videos.length}/${response.videos.length} videos`);

  return videos;
}

/**
 * Transform Funnelcake response to video page format for infinite scroll hooks
 */
export function transformToVideoPage(
  response: FunnelcakeResponse,
  cursorType: 'timestamp' | 'offset' = 'timestamp'
): {
  videos: ParsedVideoData[];
  nextCursor: number | undefined;
  offset?: number;
  hasMore: boolean;
} {
  const videos = transformFunnelcakeResponse(response);

  // Parse next cursor based on pagination type
  let nextCursor: number | undefined;
  let offset: number | undefined;

  if (response.has_more && response.next_cursor) {
    if (cursorType === 'offset') {
      offset = parseInt(response.next_cursor, 10);
    } else {
      // Timestamp cursor - parse as number
      nextCursor = parseInt(response.next_cursor, 10);
      // If parsing fails, use last video's timestamp
      if (isNaN(nextCursor) && videos.length > 0) {
        nextCursor = videos[videos.length - 1].createdAt - 1;
      }
    }
  }

  return {
    videos,
    nextCursor,
    offset,
    hasMore: response.has_more,
  };
}

/**
 * Merge Funnelcake stats into existing ParsedVideoData
 * Useful for updating videos with fresh stats
 */
export function mergeVideoStats(
  video: ParsedVideoData,
  stats: {
    reactions?: number;
    comments?: number;
    reposts?: number;
    loops?: number;
  }
): ParsedVideoData {
  return {
    ...video,
    likeCount: stats.reactions ?? video.likeCount,
    commentCount: stats.comments ?? video.commentCount,
    repostCount: stats.reposts ?? video.repostCount,
    loopCount: stats.loops ?? video.loopCount,
  };
}
