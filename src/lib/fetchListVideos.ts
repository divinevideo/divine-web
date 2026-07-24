// ABOUTME: Resolves NIP-51 list video refs into parsed videos, in list order
// ABOUTME: Handles both `a` coordinates (web-authored) and `e` event ids (mobile-authored)

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND, VIDEO_KINDS, type ParsedVideoData } from '@/types/video';
import {
  parseVideoEvent,
  validateVideoEvent,
  getVineId,
  getThumbnailUrl,
  getOriginalVineTimestamp,
  getLoopCount,
  getProofModeData,
  getOriginalLikeCount,
  getOriginalRepostCount,
  getOriginalCommentCount,
  getOriginPlatform,
  isVineMigrated,
  getTextTrackRef,
} from '@/lib/videoParser';

type NostrQuerier = {
  query: (filters: NostrFilter[], options: { signal: AbortSignal }) => Promise<NostrEvent[]>;
};

const EVENT_ID_RE = /^[0-9a-f]{64}$/i;

/** True when a list ref is a raw `e` event id rather than an `a` coordinate. */
function isEventIdRef(ref: string): boolean {
  return EVENT_ID_RE.test(ref);
}

/**
 * Map a video event to the app's ParsedVideoData, or null if it carries no
 * playable media. Shared by the coordinate/event-id resolution paths here and
 * by the single-video showcase share page.
 */
export function mapVideoEvent(event: NostrEvent): ParsedVideoData | null {
  if (!validateVideoEvent(event)) return null;

  const videoEvent = parseVideoEvent(event);
  if (!videoEvent?.videoMetadata?.url) return null;

  const duration = videoEvent.videoMetadata?.duration;
  if (duration !== undefined && duration >= 7) return null;

  const textTrack = getTextTrackRef(event);

  return {
    id: event.id,
    pubkey: event.pubkey,
    kind: event.kind as typeof SHORT_VIDEO_KIND,
    createdAt: event.created_at,
    originalVineTimestamp: getOriginalVineTimestamp(event),
    content: event.content,
    videoUrl: videoEvent.videoMetadata.url,
    fallbackVideoUrls: videoEvent.videoMetadata?.fallbackUrls,
    hlsUrl: videoEvent.videoMetadata?.hlsUrl,
    thumbnailUrl: getThumbnailUrl(videoEvent),
    blurhash: videoEvent.videoMetadata?.blurhash,
    title: videoEvent.title,
    duration: videoEvent.videoMetadata?.duration,
    dimensions: videoEvent.videoMetadata?.dimensions,
    sha256: videoEvent.videoMetadata?.hash,
    hashtags: videoEvent.hashtags || [],
    vineId: getVineId(event),
    loopCount: getLoopCount(event),
    likeCount: getOriginalLikeCount(event),
    repostCount: getOriginalRepostCount(event),
    commentCount: getOriginalCommentCount(event),
    proofMode: getProofModeData(event),
    origin: getOriginPlatform(event),
    isVineMigrated: isVineMigrated(event),
    textTrackRef: textTrack?.ref,
    textTrackLanguage: textTrack?.language,
    reposts: [], // List videos don't include repost data
    originalEvent: event, // Retained so callers can inspect moderation tags
  };
}

/**
 * Resolve an ordered mix of list video refs into videos, preserving list order.
 *
 * Each ref is either an addressable `a` coordinate (`kind:pubkey:dtag`, used by
 * web-authored lists) or a raw `e` event id (64-char hex, used by the mobile
 * app). Coordinates are grouped by pubkey and event ids batched into a single
 * `ids` filter, so a mixed list of N refs costs at most (authors + 1) queries.
 * Refs that resolve to nothing — deleted, unreachable, or non-video — drop out.
 */
export async function fetchListVideos(
  nostr: NostrQuerier,
  refs: string[],
  signal: AbortSignal
): Promise<ParsedVideoData[]> {
  if (refs.length === 0) return [];

  // Split refs by kind. Coordinates dedupe by `pubkey:dTag`; event ids by hex.
  const coordinateMap = new Map<string, { pubkey: string; dTag: string }>();
  const eventIds = new Set<string>();

  for (const ref of refs) {
    if (isEventIdRef(ref)) {
      eventIds.add(ref.toLowerCase());
      continue;
    }
    const [kind, pubkey, dTag] = ref.split(':');
    const kindNum = parseInt(kind, 10);
    if (VIDEO_KINDS.includes(kindNum) && pubkey && dTag) {
      coordinateMap.set(`${pubkey}:${dTag}`, { pubkey, dTag });
    }
  }

  const filters: NostrFilter[] = [];

  // One filter per author for the `a` coordinates.
  const pubkeyGroups = new Map<string, string[]>();
  coordinateMap.forEach(({ pubkey, dTag }) => {
    if (!pubkeyGroups.has(pubkey)) pubkeyGroups.set(pubkey, []);
    pubkeyGroups.get(pubkey)!.push(dTag);
  });
  pubkeyGroups.forEach((dTags, pubkey) => {
    filters.push({ kinds: VIDEO_KINDS, authors: [pubkey], '#d': dTags, limit: dTags.length });
  });

  // One batched filter for the `e` event ids.
  if (eventIds.size > 0) {
    filters.push({ kinds: VIDEO_KINDS, ids: [...eventIds], limit: eventIds.size });
  }

  if (filters.length === 0) return [];

  const events = await nostr.query(filters, { signal });

  // Two lookup maps so refs of either kind can be placed back in list order.
  const byCoordinate = new Map<string, ParsedVideoData>();
  const byEventId = new Map<string, ParsedVideoData>();

  for (const event of events) {
    const video = mapVideoEvent(event);
    if (!video) continue;

    byEventId.set(event.id.toLowerCase(), video);
    const vineId = getVineId(event);
    if (vineId) byCoordinate.set(`${event.pubkey}:${vineId}`, video);
  }

  // Walk the original refs so the output matches the curator's ordering, and
  // dedupe: the same video reached via both an `a` and `e` ref appears once.
  const orderedVideos: ParsedVideoData[] = [];
  const emitted = new Set<string>();

  for (const ref of refs) {
    let video: ParsedVideoData | undefined;
    if (isEventIdRef(ref)) {
      video = byEventId.get(ref.toLowerCase());
    } else {
      const [, pubkey, dTag] = ref.split(':');
      video = byCoordinate.get(`${pubkey}:${dTag}`);
    }
    if (video && !emitted.has(video.id)) {
      emitted.add(video.id);
      orderedVideos.push(video);
    }
  }

  return orderedVideos;
}
