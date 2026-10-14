// ABOUTME: Resolves pinned-video coordinates into ordered parsed video data

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { VIDEO_KINDS, type ParsedVideoData } from '@/types/video';
import { parseVideoDataFromEvent } from '@/lib/parsedVideoData';
import { isNewerParsedVideo } from '@/lib/parsedVideoSelection';
import { parseVideoCoordinate, videoCoordinateKey } from '@/lib/videoCoordinates';

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

export function resolvePinnedVideosFromEvents(
  coordinates: string[],
  events: NostrEvent[],
): ParsedVideoData[] {
  const videoMap = new Map<string, ParsedVideoData>();

  for (const event of events) {
    const video = parseVideoDataFromEvent(event);
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
