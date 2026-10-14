// ABOUTME: Parses public NIP-51 kind 30000 follow sets into discoverable people lists

import type { NostrEvent } from '@nostrify/nostrify';
import { buildAddressableCoordinate, isHex64 } from '@/lib/nostrCoordinates';
import { compareNostrEventsByNewest } from '@/lib/nostrEvents';

export const PEOPLE_LIST_KIND = 30000;

const RESERVED_LIST_DTAGS = new Set([
  'mute',
  'mutelist',
  'mute-list',
  'mute list',
  'muted',
  'block',
  'blocklist',
  'block-list',
  'block list',
  'blocked',
  'dm-contacts',
  'dm contacts',
  'dmcontacts',
  'hidden',
  'denylist',
  'deny-list',
  'deny list',
]);

export interface PeopleList {
  id: string;
  name: string;
  description?: string;
  image?: string;
  pubkey: string;
  createdAt: number;
  memberPubkeys: string[];
}

export function isReservedListDTag(dTag: string): boolean {
  return RESERVED_LIST_DTAGS.has(dTag.trim().toLowerCase());
}

export function peopleListAddress(list: PeopleList): string {
  return buildAddressableCoordinate(PEOPLE_LIST_KIND, list.pubkey, list.id);
}

export function parsePeopleListFromEvent(event: NostrEvent): PeopleList | null {
  if (event.kind !== PEOPLE_LIST_KIND) return null;

  const id = event.tags.find((tag) => tag[0] === 'd')?.[1];
  if (!id || isReservedListDTag(id)) return null;

  const memberPubkeys = Array.from(new Set(
    event.tags
      .filter((tag) => tag[0] === 'p' && Boolean(tag[1]) && isHex64(tag[1]))
      .map((tag) => tag[1].toLowerCase()),
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

  // Sort the events, not the parsed lists: two versions of the same list can
  // share a created_at, and only the event id breaks that tie deterministically.
  [...events]
    .sort(compareNostrEventsByNewest)
    .map(parsePeopleListFromEvent)
    .filter((list): list is PeopleList => list !== null)
    .forEach((list) => {
      const address = peopleListAddress(list);
      if (!newestByAddress.has(address)) {
        newestByAddress.set(address, list);
      }
    });

  return Array.from(newestByAddress.values());
}
