// ABOUTME: Resolves pinned-video coordinates into ordered parsed video data

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND, VIDEO_KINDS, type ParsedVideoData } from '@/types/video';
import { isNewerParsedVideo } from '@/lib/parsedVideoSelection';
import { parseVideoCoordinate, videoCoordinateKey } from '@/lib/videoCoordinates';
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

export function buildPinnedVideoFilters(coordinates: string[]): NostrFilter[] {
  const pubkeyGroups = new Map<string, string[]>();

  for (const value of coordinates) {
    const coordinate = parseVideoCoordinate(value, VIDEO_KINDS);
    if (!coordinate) continue;
    pubkeyGroups.set(coordinate.pubkey, [
      ...(pubkeyGroups.get(coordinate.pubkey) ?? []),
      coordinate.dTag,
    ]);
  }

  return Array.from(pubkeyGroups.entries()).map(([pubkey, dTags]) => ({
    kinds: VIDEO_KINDS,
    authors: [pubkey],
    '#d': Array.from(new Set(dTags)),
  }));
}

function parsePinnedVideoEvent(event: NostrEvent): ParsedVideoData | null {
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

export function resolvePinnedVideosFromEvents(
  coordinates: string[],
  events: NostrEvent[],
): ParsedVideoData[] {
  const videoMap = new Map<string, ParsedVideoData>();

  for (const event of events) {
    const video = parsePinnedVideoEvent(event);
    if (!video?.vineId) continue;

    const key = videoCoordinateKey({ pubkey: event.pubkey, dTag: video.vineId });
    const existing = videoMap.get(key);
    if (!existing || isNewerParsedVideo(video, existing)) {
      videoMap.set(key, video);
    }
  }

  return coordinates.flatMap((value) => {
    const coordinate = parseVideoCoordinate(value, VIDEO_KINDS);
    if (!coordinate) return [];

    const video = videoMap.get(videoCoordinateKey(coordinate));
    return video ? [video] : [];
  });
}
