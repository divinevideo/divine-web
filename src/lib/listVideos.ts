// ABOUTME: Resolves ordered video list members into parsed video grid data

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { ParsedVideoData } from '@/types/video';
import {
  LIST_VIDEO_KINDS,
  type VideoListMember,
} from '@/lib/parseVideoListFromEvent';
import { parseVideoDataFromEvent } from '@/lib/parsedVideoData';
import { isNewerParsedVideo } from '@/lib/parsedVideoSelection';
import { parseVideoCoordinate, videoCoordinateKey } from '@/lib/videoCoordinates';

export interface ListVideoData extends ParsedVideoData {
  listMember: VideoListMember;
}

// Keep id filters comfortably below common relay request-size limits.
const IDS_CHUNK_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function coordinateKey(member: VideoListMember): string | null {
  if (member.type !== 'a') return null;
  const coordinate = parseVideoCoordinate(member.value, LIST_VIDEO_KINDS);
  return coordinate ? videoCoordinateKey(coordinate) : null;
}

function buildListVideoFilters(members: VideoListMember[]): NostrFilter[] {
  const filters: NostrFilter[] = [];
  const eventIds = members
    .filter((member): member is Extract<VideoListMember, { type: 'e' }> => member.type === 'e')
    .map(member => member.value);

  for (const ids of chunk(eventIds, IDS_CHUNK_SIZE)) {
    filters.push({
      kinds: LIST_VIDEO_KINDS,
      ids,
    });
  }

  const pubkeyGroups = new Map<string, string[]>();
  for (const member of members) {
    if (member.type !== 'a') continue;
    const coordinate = parseVideoCoordinate(member.value, LIST_VIDEO_KINDS);
    if (!coordinate) continue;
    pubkeyGroups.set(coordinate.pubkey, [
      ...(pubkeyGroups.get(coordinate.pubkey) ?? []),
      coordinate.dTag,
    ]);
  }

  for (const [pubkey, dTags] of pubkeyGroups) {
    const uniqueDTags = Array.from(new Set(dTags));
    filters.push({
      kinds: LIST_VIDEO_KINDS,
      authors: [pubkey],
      '#d': uniqueDTags,
    });
  }

  return filters;
}

export async function fetchListVideos(
  nostr: { query: (filters: NostrFilter[], options: { signal: AbortSignal }) => Promise<NostrEvent[]> },
  members: VideoListMember[],
  signal: AbortSignal
): Promise<ListVideoData[]> {
  if (members.length === 0) return [];

  const filters = buildListVideoFilters(members);
  if (filters.length === 0) return [];

  const events = await nostr.query(filters, { signal });
  const eventMap = new Map<string, ParsedVideoData>();
  const coordinateMap = new Map<string, ParsedVideoData>();

  for (const event of events) {
    const video = parseVideoDataFromEvent(event);
    if (!video) continue;

    eventMap.set(event.id, video);
    if (!video.vineId) continue;

    const key = videoCoordinateKey({ pubkey: event.pubkey, dTag: video.vineId });
    const existing = coordinateMap.get(key);
    if (!existing || isNewerParsedVideo(video, existing)) {
      coordinateMap.set(key, video);
    }
  }

  const orderedVideos: ListVideoData[] = [];
  const seenVideoIds = new Set<string>();

  for (const member of members) {
    const video = member.type === 'e'
      ? eventMap.get(member.value)
      : coordinateMap.get(coordinateKey(member) ?? '');

    if (!video || seenVideoIds.has(video.id)) continue;
    seenVideoIds.add(video.id);
    orderedVideos.push({ ...video, listMember: member });
  }

  return orderedVideos;
}
