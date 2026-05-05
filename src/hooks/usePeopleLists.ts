// src/hooks/usePeopleLists.ts
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { parsePeopleList, PEOPLE_LIST_KIND, type PeopleList } from '@/types/peopleList';

export function usePeopleLists(pubkey: string | undefined) {
  const { nostr } = useNostr();
  return useQuery<PeopleList[]>({
    queryKey: ['people-lists', pubkey],
    enabled: !!pubkey,
    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [{ kinds: [PEOPLE_LIST_KIND], authors: [pubkey!], limit: 100 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) },
      );
      // Dedupe by d-tag, keep latest created_at
      const byD = new Map<string, typeof events[number]>();
      for (const evt of events) {
        const d = evt.tags.find(t => t[0] === 'd')?.[1];
        if (!d) continue;
        const existing = byD.get(d);
        if (!existing || evt.created_at > existing.created_at) byD.set(d, evt);
      }
      return Array.from(byD.values())
        .map(parsePeopleList)
        .filter((l): l is PeopleList => l !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
