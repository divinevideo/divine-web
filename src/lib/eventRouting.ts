import type { NostrEvent } from '@nostrify/nostrify';
import { VIDEO_KINDS } from '@/types/video';
import { isReservedPeopleListDTag } from '@/lib/peopleListConstants';
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

export function buildVideoPath(identifier: string): string {
  return `/video/${encodeURIComponent(identifier)}`;
}

export function buildProfilePath(identifier: string): string {
  return buildProfileLinkPath({
    pubkey: identifier,
    fallbackRoute: 'profile',
  });
}

export function buildListPath(pubkey: string, listId: string): string {
  return `/list/${pubkey}/${encodeURIComponent(listId)}`;
}

export function buildPeopleListPath(pubkey: string, listId: string): string {
  return `/people-lists/${pubkey}/${encodeURIComponent(listId)}`;
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

export function getEventDTag(event: Pick<NostrEvent, 'tags'>): string | null {
  return event.tags.find(tag => tag[0] === 'd')?.[1] || null;
}

export function buildAddressableRoute(kind: number, pubkey: string, identifier: string): string {
  if (VIDEO_KINDS.includes(kind as typeof VIDEO_KINDS[number])) {
    return buildVideoPath(identifier);
  }

  if (kind === VIDEO_LIST_EVENT_KIND) {
    return buildListPath(pubkey, identifier);
  }

  if (kind === PEOPLE_LIST_EVENT_KIND && !isReservedPeopleListDTag(identifier)) {
    return buildPeopleListPath(pubkey, identifier);
  }

  return buildAddressableEventPath(kind, pubkey, identifier);
}

export function buildResolvedEventRoute(event: Pick<NostrEvent, 'id' | 'kind' | 'pubkey' | 'tags'>): string {
  if (VIDEO_KINDS.includes(event.kind as typeof VIDEO_KINDS[number])) {
    return buildVideoPath(getEventDTag(event) || event.id);
  }

  const dTag = getEventDTag(event);
  if (dTag && event.kind === VIDEO_LIST_EVENT_KIND) {
    return buildListPath(event.pubkey, dTag);
  }

  if (dTag && event.kind === PEOPLE_LIST_EVENT_KIND && !isReservedPeopleListDTag(dTag)) {
    return buildPeopleListPath(event.pubkey, dTag);
  }

  return buildEventPath(event.id);
}
