// ABOUTME: Public relay queries for NIP-51 kind 30000 people lists

import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { deduplicatePeopleLists, PEOPLE_LIST_KIND } from '@/lib/parsePeopleListFromEvent';

export function usePeopleLists(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['people-lists', pubkey],
    queryFn: async ({ signal }) => {
      const events = await nostr.query([{
        kinds: [PEOPLE_LIST_KIND],
        authors: [pubkey!],
        limit: 100,
      }], {
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      });

      return deduplicatePeopleLists(events);
    },
    enabled: Boolean(pubkey),
    staleTime: 60_000,
    gcTime: 300_000,
  });
}

export function usePeopleList(pubkey: string | undefined, listId: string | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['people-list', pubkey, listId],
    queryFn: async ({ signal }) => {
      const events = await nostr.query([{
        kinds: [PEOPLE_LIST_KIND],
        authors: [pubkey!],
        '#d': [listId!],
        limit: 10,
      }], {
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      });

      return deduplicatePeopleLists(events)[0] ?? null;
    },
    enabled: Boolean(pubkey && listId),
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
