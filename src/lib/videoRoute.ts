// ABOUTME: Decodes the /video/:id route segment into what the video page looks a video up by
// ABOUTME: A kind:pubkey:d coordinate holds the lookup to that author; anything else is a bare id

import { decode } from 'nostr-tools/nip19';

import { parseCoordinateWithOptionalDTag, type AddressableCoordinate } from '@/lib/nostrCoordinates';
import { VIDEO_KINDS, type ParsedVideoData } from '@/types/video';

export interface VideoRouteTarget {
  /** The event id or `d` tag to look the video up by. REST `/api/videos/{id}` accepts either. */
  lookupId: string;
  eventId?: string;
  relayHints?: string[];
  strictKind?: true;
  legacyAuthor?: string;
  /**
   * The author and `d` tag the route names, or null when it names no author.
   *
   * Divine's `d` tag is the sha256 of the uploaded file, so two accounts that
   * upload the same file share one, and any account can publish under any
   * `d` tag. A route that names an author must only resolve that author's video.
   */
  address: AddressableCoordinate | null;
}

/**
 * Decode a `/video/:id` segment. A video-kind `kind:pubkey:d` coordinate (what
 * `buildAddressableVideoPath` writes for an `naddr1`) becomes an author-held
 * lookup of its `d` tag; an event id, a bare `d` tag, or anything else stays a
 * bare lookup id, as before. An empty `d` tag, which NIP-19 allows, stays held
 * to the author and so resolves to nothing: no valid video has one.
 */
export function parseVideoRouteId(routeId: string, legacyAuthor?: string | null): VideoRouteTarget {
  const legacyTarget: VideoRouteTarget = /^[0-9a-f]{64}$/i.test(legacyAuthor ?? '')
    ? { lookupId: routeId, address: null, legacyAuthor: legacyAuthor!.toLowerCase() }
    : { lookupId: routeId, address: null };
  if (/^(naddr|nevent|note)1/i.test(routeId)) {
    try {
      const reference = decode(routeId);
      if (reference.type === 'naddr') {
        const { identifier, pubkey, kind, relays } = reference.data;
        if (![34235, 34236].includes(kind)) return { lookupId: '', address: null };
        return {
          lookupId: identifier,
          strictKind: true,
          address: { kind, pubkey: pubkey.toLowerCase(), dTag: identifier },
          ...(relays?.length && { relayHints: relays }),
        };
      }
      if (reference.type === 'nevent') {
        const { id, relays } = reference.data;
        return { lookupId: id, eventId: id, address: null, ...(relays?.length && { relayHints: relays }) };
      }
      if (reference.type === 'note') return { lookupId: reference.data, eventId: reference.data, address: null };
      return { lookupId: routeId, address: null };
    } catch {
      return legacyTarget;
    }
  }
  const coordinate = parseCoordinateWithOptionalDTag(routeId);
  if (!coordinate || !VIDEO_KINDS.includes(coordinate.kind as typeof VIDEO_KINDS[number])) {
    return legacyTarget;
  }

  const address = { ...coordinate, pubkey: coordinate.pubkey.toLowerCase() };
  return { lookupId: address.dTag, address };
}

/**
 * Whether `video` is the one a route asks for. A bare id matches the event id
 * or the `d` tag of a video by anyone. With an author, only that author's video
 * with `lookupId` as its `d` tag matches: an event id match is not accepted,
 * because a `d` tag is free text and another video's can equal this id.
 */
export function matchesVideoRoute(
  video: Pick<ParsedVideoData, 'id' | 'vineId' | 'pubkey'>,
  lookupId: string,
  author?: string,
): boolean {
  if (author) {
    return video.vineId === lookupId && video.pubkey.toLowerCase() === author.toLowerCase();
  }
  return video.id === lookupId || video.vineId === lookupId;
}

export function matchesVideoTarget(
  video: Pick<ParsedVideoData, 'id' | 'vineId' | 'pubkey'> & { kind?: number; originalEvent?: { kind: number } },
  target: VideoRouteTarget,
): boolean {
  if (!target.lookupId) return false;
  if (target.eventId) return video.id === target.eventId;
  if (target.legacyAuthor) {
    return video.pubkey.toLowerCase() === target.legacyAuthor
      && (video.id === target.lookupId || video.vineId === target.lookupId);
  }
  if (target.strictKind && target.address && (video.originalEvent?.kind ?? video.kind) !== target.address.kind) return false;
  return matchesVideoRoute(video, target.lookupId, target.address?.pubkey);
}
