// ABOUTME: Decides what a click on a video sticker opens: a web page, profile, hashtag, video or map
// ABOUTME: Pure mapping from a parsed sticker to a route or an external http(s) address

import { nip19 } from 'nostr-tools';
import { buildAddressableVideoPath, buildProfilePath, buildVideoPath } from '@/lib/eventRouting';
import { parseAddressableCoordinate } from '@/lib/nostrCoordinates';
import type { ParsedVideoData, VideoSticker, VideoStickerKind } from '@/types/video';

export type VideoStickerAction =
  /** A page outside Divine, opened in a new tab with no opener or referrer. */
  | { type: 'external'; url: string }
  /** A page of this app; `ownerPubkey` keeps a profile subdomain link local. */
  | { type: 'internal'; path: string; ownerPubkey?: string };

/**
 * The kinds that get a button on the web for now. The rest stay visible in
 * the frames only: a countdown for good (the web has no reminders), the sound
 * page, votes, questions, Add yours and replies until the web can act on them.
 */
const CLICKABLE_KINDS: ReadonlySet<VideoStickerKind> = new Set<VideoStickerKind>([
  'link',
  'mention',
  'hashtag',
  'reply',
  'place',
]);

/** Whether a click on `sticker` has somewhere to go on the web. */
export function isClickableVideoSticker(sticker: Pick<VideoSticker, 'kind' | 'target'>): boolean {
  return CLICKABLE_KINDS.has(sticker.kind) && sticker.target.length > 0;
}

/**
 * OpenStreetMap's search for a place's full name, such as
 * "Zermatt, Wallis, Schweiz". The same page the app falls back to: it needs
 * no account or app, tracks no one, and the sticker keeps no coordinates,
 * so a search by name is all there is to open.
 */
export function mapSearchUrl(query: string): string {
  return `https://www.openstreetmap.org/search?${new URLSearchParams({ query })}`;
}

/** The video page of a NIP-22 root: its `kind:pubkey:d` address or event id. */
export function videoRoutePath(routeId: string): string {
  const address = parseAddressableCoordinate(routeId);
  return address
    ? buildAddressableVideoPath(address.kind, address.pubkey, address.dTag)
    : buildVideoPath(routeId);
}

/** `url` when it is an http(s) address with a host, else null. */
function safeExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname) {
      return parsed.href;
    }
  } catch {
    // Not a URL.
  }
  return null;
}

/**
 * What a click on `sticker` on `video` opens, or null when it opens nothing on
 * the web. A reply opens the video the reply's own NIP-22 root tags name, as
 * the app does, and the sticker's target when they name none.
 */
export function getVideoStickerAction(
  sticker: Pick<VideoSticker, 'kind' | 'target'>,
  video: Pick<ParsedVideoData, 'replyRootRouteId'>,
): VideoStickerAction | null {
  if (!isClickableVideoSticker(sticker)) return null;
  switch (sticker.kind) {
    case 'link': {
      // Parsing already allows only http(s); checked again where it opens.
      const url = safeExternalUrl(sticker.target);
      return url ? { type: 'external', url } : null;
    }
    case 'mention':
      try {
        nip19.npubEncode(sticker.target);
      } catch {
        return null;
      }
      return { type: 'internal', path: buildProfilePath(sticker.target), ownerPubkey: sticker.target };
    case 'hashtag':
      return { type: 'internal', path: `/hashtag/${encodeURIComponent(sticker.target)}` };
    case 'reply':
      return { type: 'internal', path: videoRoutePath(video.replyRootRouteId ?? sticker.target) };
    case 'place':
      return { type: 'external', url: mapSearchUrl(sticker.target) };
    default:
      return null;
  }
}
