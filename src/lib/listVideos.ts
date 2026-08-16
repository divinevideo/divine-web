// ABOUTME: Resolves ordered video list members into parsed video grid data

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND, VIDEO_KINDS, type ParsedVideoData } from '@/types/video';
import {
  LIST_VIDEO_KINDS,
  type VideoListMember,
} from '@/lib/parseVideoListFromEvent';
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

export interface ListVideoData extends ParsedVideoData {
  listMember: VideoListMember;
}

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
  const [kind, pubkey, dTag] = member.value.split(':');
  if (!LIST_VIDEO_KINDS.includes(Number(kind)) || !pubkey || !dTag) return null;
  return `${pubkey}:${dTag}`;
}

function buildListVideoFilters(members: VideoListMember[]): NostrFilter[] {
  const filters: NostrFilter[] = [];
  const eventIds = members
    .filter((member): member is Extract<VideoListMember, { type: 'e' }> => member.type === 'e')
    .map(member => member.value);

  for (const ids of chunk(eventIds, IDS_CHUNK_SIZE)) {
    filters.push({
      kinds: VIDEO_KINDS,
      ids,
      limit: ids.length,
    });
  }

  const pubkeyGroups = new Map<string, string[]>();
  for (const member of members) {
    if (member.type !== 'a') continue;
    const [kind, pubkey, dTag] = member.value.split(':');
    if (!LIST_VIDEO_KINDS.includes(Number(kind)) || !pubkey || !dTag) continue;
    pubkeyGroups.set(pubkey, [...(pubkeyGroups.get(pubkey) ?? []), dTag]);
  }

  for (const [pubkey, dTags] of pubkeyGroups) {
    filters.push({
      kinds: LIST_VIDEO_KINDS,
      authors: [pubkey],
      '#d': Array.from(new Set(dTags)),
      limit: dTags.length,
    });
  }

  return filters;
}

function parseListVideoEvent(event: NostrEvent): ParsedVideoData | null {
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
    const video = parseListVideoEvent(event);
    if (!video) continue;

    eventMap.set(event.id, video);
    coordinateMap.set(`${event.pubkey}:${video.vineId}`, video);
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
