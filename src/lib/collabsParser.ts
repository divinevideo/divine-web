import type { NostrEvent } from '@nostrify/nostrify';

export const SHORT_VIDEO_KIND = 34236 as const;
export const COLLAB_RESPONSE_KIND = 34238 as const;

export function dTagOf(event: NostrEvent): string {
  const tag = event.tags.find((t) => t[0] === 'd');
  if (!tag || !tag[1]) {
    throw new Error('Event is missing d tag');
  }
  return tag[1];
}

export function coordOf(event: NostrEvent): string {
  return `${event.kind}:${event.pubkey}:${dTagOf(event)}`;
}

export function getATagValues(event: NostrEvent): string[] {
  return event.tags.filter((t) => t[0] === 'a' && typeof t[1] === 'string').map((t) => t[1]);
}

export interface PTagCollaborator {
  pubkey: string;
  role?: string;
}

export function parsePTagCollaborator(tag: string[]): PTagCollaborator | null {
  if (tag[0] !== 'p' || !tag[1]) return null;
  const role = tag[2];
  return role ? { pubkey: tag[1], role } : { pubkey: tag[1] };
}

export function dedupeAndSubtract(
  taggedVideos: NostrEvent[],
  acceptedCoords: Set<string>,
  mePubkey: string,
): NostrEvent[] {
  const latestByCoord = new Map<string, NostrEvent>();
  for (const v of taggedVideos) {
    if (v.pubkey === mePubkey) continue;
    let coord: string;
    try { coord = coordOf(v); } catch { continue; }
    const prev = latestByCoord.get(coord);
    if (!prev || prev.created_at < v.created_at) {
      latestByCoord.set(coord, v);
    }
  }
  return [...latestByCoord.entries()]
    .filter(([coord]) => !acceptedCoords.has(coord))
    .map(([, event]) => event);
}
