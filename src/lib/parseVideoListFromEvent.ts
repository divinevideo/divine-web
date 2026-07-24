// ABOUTME: Pure parser for NIP-51 kind 30005 video list events into app VideoList shape

import type { NostrEvent } from '@nostrify/nostrify';
import { VIDEO_KINDS } from '@/types/video';

export type PlayOrder = 'chronological' | 'reverse' | 'manual' | 'shuffle';

export interface VideoList {
  id: string;
  name: string;
  description?: string;
  image?: string;
  pubkey: string;
  createdAt: number;
  /** Addressable `a` references (`kind:pubkey:dtag`). Used by web-authored lists. */
  videoCoordinates: string[];
  /**
   * Raw `e` event-id references. The mobile app writes video refs this way, so
   * a list created on a phone populates this rather than `videoCoordinates`.
   */
  videoEventIds: string[];
  public: boolean;
  tags?: string[];
  isCollaborative?: boolean;
  allowedCollaborators?: string[];
  thumbnailEventId?: string;
  playOrder?: PlayOrder;
}

/**
 * Parse a video list event (kind 30005) into a VideoList, or null if invalid.
 * Uses {@link VIDEO_KINDS} for `a` tag coordinates so supported kinds stay in one place.
 */
export function parseVideoListFromEvent(event: NostrEvent): VideoList | null {
  const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
  if (!dTag) return null;

  const title = event.tags.find(tag => tag[0] === 'title')?.[1] || dTag;
  const description = event.tags.find(tag => tag[0] === 'description')?.[1];
  const image = event.tags.find(tag => tag[0] === 'image')?.[1];

  const videoCoordinates = event.tags
    .filter(tag => {
      if (tag[0] !== 'a' || !tag[1]) return false;
      return VIDEO_KINDS.some(kind => tag[1]!.startsWith(`${kind}:`));
    })
    .map(tag => tag[1]!);

  // Video refs by raw event id. NIP-51 permits `e` tags in a set, and the
  // mobile app uses them exclusively; keep only 64-char hex to skip stray tags.
  const videoEventIds = event.tags
    .filter(tag => tag[0] === 'e' && /^[0-9a-f]{64}$/i.test(tag[1] ?? ''))
    .map(tag => tag[1]!);

  const tags = event.tags
    .filter(tag => tag[0] === 't')
    .map(tag => tag[1]!);

  const isCollaborative = event.tags.find(tag => tag[0] === 'collaborative')?.[1] === 'true';
  const allowedCollaborators = event.tags
    .filter(tag => tag[0] === 'collaborator')
    .map(tag => tag[1]!);

  const thumbnailEventId = event.tags.find(tag => tag[0] === 'thumbnail-event')?.[1];

  const playOrderTag = event.tags.find(tag => tag[0] === 'play-order')?.[1];
  const playOrder: PlayOrder =
    playOrderTag === 'reverse' || playOrderTag === 'manual' || playOrderTag === 'shuffle'
      ? playOrderTag
      : 'chronological';

  let privateCoordinates: string[] = [];
  if (event.content) {
    try {
      privateCoordinates = [];
    } catch {
      // Ignore decryption errors
    }
  }

  return {
    id: dTag,
    name: title,
    description,
    image,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    videoCoordinates: [...videoCoordinates, ...privateCoordinates],
    videoEventIds,
    public: true,
    tags,
    isCollaborative,
    allowedCollaborators,
    thumbnailEventId,
    playOrder,
  };
}
