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
  return events.filter(event => !LIST_KINDS.includes(event.kind) || !deletions.some(deletion => (
    deletion.kind === 5 && deletion.pubkey === event.pubkey && deletion.tags.some(([name, target]) => (
      (name === 'e' && target === event.id) ||
      (name === 'a' && target === listCoordinate(event) && event.created_at <= deletion.created_at)
    ))
  )));
}
