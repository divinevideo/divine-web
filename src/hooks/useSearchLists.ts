// ABOUTME: Hook for searching Nostr lists (kind 30000 people lists + kind 30005 video sets)
// ABOUTME: Uses NIP-50 relay search with local-filter fallback when relay returns nothing

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useState, useEffect } from 'react';
import { parsePeopleList, type PeopleList } from '@/types/peopleList';
import { parseVideoList, type VideoList } from '@/hooks/useVideoLists';

export type SearchListResult =
  | { kind: 30000; list: PeopleList }
  | { kind: 30005; list: VideoList };

interface UseSearchListsOptions {
  query: string;
  limit?: number;
}

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delay <= 0) {
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function matchesQuery(name: string | undefined, description: string | undefined, query: string): boolean {
  const lower = query.toLowerCase();
  return (
    (name?.toLowerCase().includes(lower) ?? false) ||
    (description?.toLowerCase().includes(lower) ?? false)
  );
}

/**
 * Search lists (kind 30000 + 30005) via NIP-50 relay search.
 * Falls back to fetching recent events and filtering locally if NIP-50 returns nothing.
 */
export function useSearchLists(options: UseSearchListsOptions) {
  const { nostr } = useNostr();
  const { query, limit = 50 } = options;

  const isTest = process.env.NODE_ENV === 'test';
  const debounceMs = isTest ? 0 : 300;
  const debouncedQuery = useDebouncedValue(query, debounceMs);

  return useQuery({
    queryKey: ['search-lists', debouncedQuery, limit],
    queryFn: async ({ signal }) => {
      if (!debouncedQuery.trim()) {
        return [];
      }

      // NIP-50 path: relay full-text search
      const nip50Events = await nostr.query(
        [{ kinds: [30000, 30005], search: debouncedQuery, limit }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) },
      );

      if (nip50Events.length > 0) {
        return eventsToResults(nip50Events);
      }

      // Fallback: fetch recent events and filter locally by name/description
      const recentEvents = await nostr.query(
        [{ kinds: [30000, 30005], limit }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) },
      );

      const filtered = recentEvents.filter(event => {
        if (event.kind === 30000) {
          const list = parsePeopleList(event);
          return list && matchesQuery(list.name, list.description, debouncedQuery);
        }
        if (event.kind === 30005) {
          const list = parseVideoList(event);
          return list && matchesQuery(list.name, list.description, debouncedQuery);
        }
        return false;
      });

      return eventsToResults(filtered);
    },
    enabled: !!debouncedQuery.trim(),
    staleTime: 60_000,
    gcTime: 300_000,
  });
}

import type { NostrEvent } from '@nostrify/nostrify';

function eventsToResults(events: NostrEvent[]): SearchListResult[] {
  const results: SearchListResult[] = [];
  for (const event of events) {
    if (event.kind === 30000) {
      // Public search surfaces require a real name — skip events whose name
      // would fall back to the d-tag, which is how non-curated system lists
      // from other clients leak in.
      const hasTitle = !!event.tags.find(t => t[0] === 'title')?.[1];
      if (!hasTitle) continue;
      const list = parsePeopleList(event);
      if (list) results.push({ kind: 30000, list });
    } else if (event.kind === 30005) {
      const list = parseVideoList(event);
      if (list) results.push({ kind: 30005, list });
    }
  }
  return results;
}
