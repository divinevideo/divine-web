// src/types/peopleList.ts
import type { NostrEvent } from '@nostrify/nostrify';

export const PEOPLE_LIST_KIND = 30000;

export interface PeopleList {
  id: string;            // d-tag
  pubkey: string;        // owner
  name: string;          // title tag, falls back to id
  description?: string;
  image?: string;
  members: string[];     // hex pubkeys, deduped
  createdAt: number;
}

const HEX64 = /^[0-9a-f]{64}$/i;

export function parsePeopleList(event: NostrEvent): PeopleList | null {
  if (event.kind !== PEOPLE_LIST_KIND) return null;
  const dTag = event.tags.find(t => t[0] === 'd')?.[1];
  if (!dTag) return null;

  const seen = new Set<string>();
  const members: string[] = [];
  for (const t of event.tags) {
    if (t[0] !== 'p') continue;
    const pk = t[1];
    if (!pk || !HEX64.test(pk) || seen.has(pk)) continue;
    seen.add(pk);
    members.push(pk);
  }

  return {
    id: dTag,
    pubkey: event.pubkey,
    name: event.tags.find(t => t[0] === 'title')?.[1] || dTag,
    description: event.tags.find(t => t[0] === 'description')?.[1],
    image: event.tags.find(t => t[0] === 'image')?.[1],
    members,
    createdAt: event.created_at,
  };
}

export function peopleListAddressableId(pubkey: string, dTag: string): string {
  return `${PEOPLE_LIST_KIND}:${pubkey}:${dTag}`;
}
