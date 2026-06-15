// ABOUTME: Hook that resolves saved-list addressable IDs to live list events.
// ABOUTME: Drops stale/dead references (relay returns 0 events or wrong kind).

import { useQueries } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useSavedLists } from './useSavedLists';
import { parsePeopleList, PEOPLE_LIST_KIND, type PeopleList } from '@/types/peopleList';
import { parseVideoList, type VideoList } from './useVideoLists';

const VIDEO_LIST_KIND = 30005;

export interface ResolvedSavedLists {
  people: PeopleList[];
  video: VideoList[];
  isLoading: boolean;
  isError: boolean;
}

type ResolvedResult =
  | { kind: typeof PEOPLE_LIST_KIND; list: PeopleList }
  | { kind: typeof VIDEO_LIST_KIND; list: VideoList }
  | null;

/**
 * Resolves each saved-list reference (from kind 30003) to its live list event.
 *
 * Stale-reference filtering: if the relay returns 0 events for a ref, or the
 * returned event's kind doesn't match the ref's expected kind (e.g. a kind 5
 * deletion tombstone slipped through), the ref is silently dropped.
 */
export function useResolvedSavedLists(): ResolvedSavedLists {
  const { nostr } = useNostr();
  const saved = useSavedLists();
  const refs = saved.data ?? [];

  const queries = useQueries({
    queries: refs.map((r) => ({
      queryKey: ['saved-list-resolved', r.kind, r.pubkey, r.dTag] as const,
      enabled: !!nostr,
      staleTime: 60_000,
      queryFn: async ({ signal }: { signal: AbortSignal }): Promise<ResolvedResult> => {
        const events = await nostr.query(
          [{ kinds: [r.kind], authors: [r.pubkey], '#d': [r.dTag], limit: 1 }],
          { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) },
        );

        // Stale-reference: nothing found on relay → drop
        if (events.length === 0) return null;

        const evt = events[0];

        if (evt.kind === PEOPLE_LIST_KIND) {
          const list = parsePeopleList(evt);
          if (!list) return null;
          return { kind: PEOPLE_LIST_KIND, list };
        }

        if (evt.kind === VIDEO_LIST_KIND) {
          const list = parseVideoList(evt);
          if (!list) return null;
          return { kind: VIDEO_LIST_KIND, list };
        }

        // Kind mismatch (e.g. relay returned a deletion event) → drop
        return null;
      },
    })),
  });

  const people: PeopleList[] = queries
    .map((q) => q.data)
    .filter((d): d is { kind: typeof PEOPLE_LIST_KIND; list: PeopleList } =>
      d !== null && d !== undefined && d.kind === PEOPLE_LIST_KIND,
    )
    .map((d) => d.list);

  const video: VideoList[] = queries
    .map((q) => q.data)
    .filter((d): d is { kind: typeof VIDEO_LIST_KIND; list: VideoList } =>
      d !== null && d !== undefined && d.kind === VIDEO_LIST_KIND,
    )
    .map((d) => d.list);

  return {
    people,
    video,
    isLoading: (saved.isLoading ?? false) || queries.some((q) => q.isLoading),
    isError: (saved.isError ?? false) || queries.some((q) => q.isError),
  };
}
