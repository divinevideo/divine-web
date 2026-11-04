import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

export const LIST_KINDS = [30000, 30001, 30005];

export function buildListDeletionDiscoveryFilters(filters: NostrFilter[]): NostrFilter[] {
  return filters.flatMap((filter): NostrFilter[] => {
    const kinds = filter.kinds?.filter(kind => LIST_KINDS.includes(kind));
    if (!kinds?.length) return [];
    return [{
      kinds: [5],
      ...(filter.authors ? { authors: filter.authors } : { '#k': kinds.map(String) }),
    }];
  });
}

function listCoordinate(event: NostrEvent): string {
  return `${event.kind}:${event.pubkey}:${event.tags.find(([name]) => name === 'd')?.[1] ?? ''}`;
}

export function buildListDeletionFilters(events: NostrEvent[]): NostrFilter[] {
  const lists = events.filter(event => LIST_KINDS.includes(event.kind));
  if (lists.length === 0) return [];

  const authors = [...new Set(lists.map(event => event.pubkey))];
  return [
    { kinds: [5], authors, '#a': [...new Set(lists.map(listCoordinate))] },
    { kinds: [5], authors, '#e': lists.map(event => event.id) },
  ];
}

export function excludeDeletedListEvents(events: NostrEvent[], deletions: NostrEvent[]): NostrEvent[] {
  // Index owner-scoped targets once so the filter stays linear in events + deletion tags.
  const deletedIds = new Set<string>();
  const addressDeletedAt = new Map<string, number>();
  for (const deletion of deletions) {
    if (deletion.kind !== 5) continue;
    for (const [name, target] of deletion.tags) {
      if (name === 'e') deletedIds.add(`${deletion.pubkey}|${target}`);
      if (name === 'a') {
        const key = `${deletion.pubkey}|${target}`;
        addressDeletedAt.set(key, Math.max(addressDeletedAt.get(key) ?? -Infinity, deletion.created_at));
      }
    }
  }

  return events.filter(event => {
    if (!LIST_KINDS.includes(event.kind)) return true;
    if (deletedIds.has(`${event.pubkey}|${event.id}`)) return false;
    const deletedAt = addressDeletedAt.get(`${event.pubkey}|${listCoordinate(event)}`);
    return deletedAt === undefined || event.created_at > deletedAt;
  });
}
