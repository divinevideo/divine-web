// ABOUTME: Maps a Nostr video event into ParsedVideoData grid rows

import type { NostrEvent } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND, type ParsedVideoData } from '@/types/video';
import {
  getLoopCount,
  getOriginalCommentCount,
  getOriginalLikeCount,
  getOriginalRepostCount,
  getOriginalVineTimestamp,
  getOriginPlatform,
  getProofModeData,
  getThumbnailUrl,
  getVineId,
  isVineMigrated,
  parseVideoEvent,
} from '@/lib/videoParser';

/**
 * Parse a video event into the ParsedVideoData shape used by list and pinned
 * grids. Returns null when the event has no d-tag or no playable media URL.
 */
export function parseVideoDataFromEvent(event: NostrEvent): ParsedVideoData | null {
  const vineId = getVineId(event);
  if (!vineId) return null;

  const videoEvent = parseVideoEvent(event);
  if (!videoEvent?.videoMetadata?.url) return null;

  return {
    id: event.id,
    pubkey: event.pubkey,
    kind: SHORT_VIDEO_KIND,
    createdAt: event.created_at,
    originalVineTimestamp: getOriginalVineTimestamp(event),
    content: event.content,
    videoUrl: videoEvent.videoMetadata.url,
    fallbackVideoUrls: videoEvent.videoMetadata?.fallbackUrls,
    hlsUrl: videoEvent.videoMetadata?.hlsUrl,
    thumbnailUrl: getThumbnailUrl(videoEvent),
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
    reposts: [],
  };
}
