import type { NostrEvent } from '@nostrify/nostrify';
import { VIDEO_KINDS } from '@/types/video';
import { buildProfileLinkPath } from '@/lib/profileLinks';

const LIST_EVENT_KINDS = new Set([
  3,
  10000,
  10001,
  10002,
  10003,
  30000,
  30001,
  30003,
  30004,
  30005,
]);

const NOTE_EVENT_KINDS = new Set([1, 1111]);

export const PEOPLE_LIST_EVENT_KIND = 30000;
export const VIDEO_LIST_EVENT_KIND = 30005;

const LIST_DETAIL_EVENT_KINDS = new Set([PEOPLE_LIST_EVENT_KIND, VIDEO_LIST_EVENT_KIND]);

/**
 * Query param that pins which detail surface `/list/:pubkey/:listId` renders.
 * Both list kinds share the route, so an owner can hold a kind 30000 and a
 * kind 30005 list under the same `d` tag; without the pin one of the two would
 * have no reachable URL.
 */
export const LIST_KIND_PARAM = 'kind';

export function buildVideoPath(identifier: string): string {
  return `/video/${encodeURIComponent(identifier)}`;
}

export function buildProfilePath(identifier: string): string {
  return buildProfileLinkPath({
    pubkey: identifier,
    fallbackRoute: 'profile',
  });
}

/**
 * Build the canonical list detail path. Pass `kind` whenever the caller
 * already knows which list kind it is linking to: it disambiguates same-`d`-tag
 * collisions and lets the route skip its resolver lookup.
 */
export function buildListPath(pubkey: string, listId: string, kind?: number): string {
  const path = `/list/${pubkey}/${encodeURIComponent(listId)}`;

  return kind !== undefined && isListDetailEventKind(kind)
    ? `${path}?${LIST_KIND_PARAM}=${kind}`
    : path;
}

/** Read a pinned list kind off a `/list/...` search string, if it carries one. */
export function parseListKindParam(value: string | null): number | null {
  if (!value) return null;

  const kind = Number(value);

  return isListDetailEventKind(kind) ? kind : null;
}

export function buildEventPath(eventId: string): string {
  return `/event/${encodeURIComponent(eventId)}`;
}

export function buildAddressableEventPath(kind: number, pubkey: string, identifier: string): string {
  return `/event/a/${kind}/${pubkey}/${encodeURIComponent(identifier)}`;
}

export function isListEventKind(kind: number): boolean {
  return LIST_EVENT_KINDS.has(kind);
}

export function isNoteEventKind(kind: number): boolean {
  return NOTE_EVENT_KINDS.has(kind);
}

export function isListDetailEventKind(kind: number): boolean {
  return LIST_DETAIL_EVENT_KINDS.has(kind);
}

export function getEventDTag(event: Pick<NostrEvent, 'tags'>): string | null {
  return event.tags.find(tag => tag[0] === 'd')?.[1] || null;
}

export function buildAddressableRoute(kind: number, pubkey: string, identifier: string): string {
  if (VIDEO_KINDS.includes(kind as typeof VIDEO_KINDS[number])) {
    return buildVideoPath(identifier);
  }

  if (isListDetailEventKind(kind)) {
    return buildListPath(pubkey, identifier, kind);
  }

  return buildAddressableEventPath(kind, pubkey, identifier);
}

export function buildResolvedEventRoute(event: Pick<NostrEvent, 'id' | 'kind' | 'pubkey' | 'tags'>): string {
  if (VIDEO_KINDS.includes(event.kind as typeof VIDEO_KINDS[number])) {
    return buildVideoPath(getEventDTag(event) || event.id);
  }

  const dTag = getEventDTag(event);
  if (dTag && isListDetailEventKind(event.kind)) {
    return buildListPath(event.pubkey, dTag, event.kind);
  }

  return buildEventPath(event.id);
}
