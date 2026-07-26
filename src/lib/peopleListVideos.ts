// ABOUTME: Builds bounded Nostr filters and merges videos for people-list feeds

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { VIDEO_KINDS } from '@/types/video';

const AUTHORS_PER_FILTER = 100;
export const PEOPLE_LIST_VIDEO_PAGE_SIZE = 60;

export function buildPeopleListVideoFilters(
  pubkeys: string[],
  until?: number,
): NostrFilter[] {
  const uniquePubkeys = Array.from(new Set(pubkeys));
  const filters: NostrFilter[] = [];

  for (let index = 0; index < uniquePubkeys.length; index += AUTHORS_PER_FILTER) {
    filters.push({
      kinds: VIDEO_KINDS,
      authors: uniquePubkeys.slice(index, index + AUTHORS_PER_FILTER),
      limit: PEOPLE_LIST_VIDEO_PAGE_SIZE,
      ...(until !== undefined ? { until } : {}),
    });
  }

  return filters;
}

export function mergePeopleListVideoEvents(events: NostrEvent[]): NostrEvent[] {
  const newestByAddress = new Map<string, NostrEvent>();

  events
    .filter((event) => VIDEO_KINDS.includes(event.kind))
    .sort((a, b) => b.created_at - a.created_at)
    .forEach((event) => {
      const dTag = event.tags.find((tag) => tag[0] === 'd')?.[1];
      if (!dTag) return;

      const address = `${event.pubkey}:${event.kind}:${dTag}`;
      if (!newestByAddress.has(address)) {
        newestByAddress.set(address, event);
      }
    });

  return Array.from(newestByAddress.values()).slice(0, PEOPLE_LIST_VIDEO_PAGE_SIZE);
}
