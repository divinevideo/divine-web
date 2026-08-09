import type { NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

import { getEventLookupRelayUrls } from '@/config/relays';
import { useAppContext } from '@/hooks/useAppContext';

export type ListRouteKind = 'videos' | 'people' | 'missing';

const VIDEO_LIST_KIND = 30005;
const PEOPLE_LIST_KIND = 30000;
const LIST_ROUTE_KINDS = [VIDEO_LIST_KIND, PEOPLE_LIST_KIND];

export function resolveListRouteKind(events: Array<Pick<NostrEvent, 'kind'>>): ListRouteKind {
  if (events.some(event => event.kind === VIDEO_LIST_KIND)) {
    return 'videos';
  }

  if (events.some(event => event.kind === PEOPLE_LIST_KIND)) {
    return 'people';
  }

  return 'missing';
}

export function useListRouteKind(pubkey: string | undefined, listId: string | undefined) {
  const { nostr } = useNostr();
  const { config } = useAppContext();
  const configuredRelayUrls = config.relayUrls || [config.relayUrl];
  const relayKey = configuredRelayUrls.join(',');

  return useQuery({
    queryKey: ['list-route-kind', pubkey, listId, relayKey],
    queryFn: async ({ signal }) => {
      const events = await nostr.query([{
        kinds: LIST_ROUTE_KINDS,
        authors: [pubkey!],
        '#d': [listId!],
        limit: 10,
      }], {
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
        relays: getEventLookupRelayUrls({ configuredRelayUrls }),
      });

      return resolveListRouteKind(events);
    },
    enabled: Boolean(pubkey && listId),
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
