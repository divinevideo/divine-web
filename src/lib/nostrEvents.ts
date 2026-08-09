// ABOUTME: Shared pure helpers for deterministic Nostr event selection

import type { NostrEvent } from '@nostrify/nostrify';

export function compareNostrEventsByNewest(a: NostrEvent, b: NostrEvent): number {
  return b.created_at - a.created_at || (a.id < b.id ? -1 : 1);
}

export function latestEvent(events: NostrEvent[]): NostrEvent | null {
  if (events.length === 0) return null;
  return events.slice().sort(compareNostrEventsByNewest)[0];
}

export function latestEventsByKey(
  events: NostrEvent[],
  keyFn: (event: NostrEvent) => string,
): Map<string, NostrEvent> {
  const latest = new Map<string, NostrEvent>();
  for (const event of events) {
    const key = keyFn(event);
    const existing = latest.get(key);
    if (!existing || compareNostrEventsByNewest(event, existing) < 0) {
      latest.set(key, event);
    }
  }
  return latest;
}
