// ABOUTME: Parses public NIP-51 kind 30000 follow sets into discoverable people lists

import type { NostrEvent } from '@nostrify/nostrify';
import { BLOCK_LIST_D_TAG } from '@/lib/blocklistFilter';

export const PEOPLE_LIST_KIND = 30000;

export const RESERVED_PEOPLE_LIST_D_TAGS = [
  'mute',
  'mutelist',
  'mute-list',
  'muted',
  BLOCK_LIST_D_TAG,
  'blocklist',
  'block-list',
  'blocked',
  'dm-contacts',
  'hidden',
  'denylist',
  'deny-list',
] as const;

export interface PeopleList {
  id: string;
  name: string;
  description?: string;
  image?: string;
  pubkey: string;
  createdAt: number;
  memberPubkeys: string[];
}

export function peopleListAddress(list: PeopleList): string {
  return `${list.pubkey}:${PEOPLE_LIST_KIND}:${list.id}`;
}

export function isReservedPeopleListDTag(dTag: string): boolean {
  const normalizedDTag = dTag.trim().toLowerCase();
  return RESERVED_PEOPLE_LIST_D_TAGS.includes(normalizedDTag as typeof RESERVED_PEOPLE_LIST_D_TAGS[number]);
}

function isHexPubkey(pubkey: string | undefined): pubkey is string {
  return Boolean(pubkey && /^[0-9a-f]{64}$/i.test(pubkey));
}

export function parsePeopleListFromEvent(event: NostrEvent): PeopleList | null {
  if (event.kind !== PEOPLE_LIST_KIND) return null;

  const id = event.tags.find((tag) => tag[0] === 'd')?.[1];
  if (!id || isReservedPeopleListDTag(id)) return null;

  const memberPubkeys = Array.from(new Set(
    event.tags
      .filter((tag) => tag[0] === 'p' && isHexPubkey(tag[1]))
      .map((tag) => tag[1]),
  ));

  return {
    id,
    name: event.tags.find((tag) => tag[0] === 'title')?.[1] || id,
    description: event.tags.find((tag) => tag[0] === 'description')?.[1],
    image: event.tags.find((tag) => tag[0] === 'image')?.[1],
    pubkey: event.pubkey,
    createdAt: event.created_at,
    memberPubkeys,
  };
}

export function deduplicatePeopleLists(events: NostrEvent[]): PeopleList[] {
  const newestByAddress = new Map<string, PeopleList>();

  events
    .map(parsePeopleListFromEvent)
    .filter((list): list is PeopleList => list !== null)
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((list) => {
      const address = peopleListAddress(list);
      if (!newestByAddress.has(address)) {
        newestByAddress.set(address, list);
      }
    });

  return Array.from(newestByAddress.values());
}
