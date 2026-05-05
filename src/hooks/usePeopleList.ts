// src/hooks/usePeopleList.ts
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { parsePeopleList, PEOPLE_LIST_KIND, type PeopleList } from '@/types/peopleList';

export function usePeopleList(pubkey: string, dTag: string) {
  const { nostr } = useNostr();
  return useQuery<PeopleList | null>({
    queryKey: ['people-list', pubkey, dTag],
    enabled: pubkey.length > 0 && dTag.length > 0,
    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [{ kinds: [PEOPLE_LIST_KIND], authors: [pubkey], '#d': [dTag], limit: 1 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) },
      );
      if (events.length === 0) return null;

      // Defensive: if relay returns multiple events, pick the one with highest created_at
      const latest = events.reduce((best, evt) =>
        evt.created_at > best.created_at ? evt : best,
      );

      return parsePeopleList(latest);
    },
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
