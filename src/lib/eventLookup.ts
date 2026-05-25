import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { API_CONFIG } from '@/config/api';
import { getEventLookupRelayUrls } from '@/config/relays';

interface NostrQueryClient {
  query: (filters: NostrFilter[], options: { signal: AbortSignal; relays?: string[] }) => Promise<NostrEvent[]>;
}

export interface AddressableEventRef {
  kind: number;
  pubkey: string;
  identifier: string;
}

export interface EventLookupOptions {
  relayHints?: string[];
  relayUrls?: string[];
}

function resolveEventLookupRelays(options?: EventLookupOptions): string[] {
  return getEventLookupRelayUrls({
    configuredRelayUrls: options?.relayUrls,
    relayHints: options?.relayHints,
  });
}

export async function fetchEventByIdFromApi(eventId: string, signal?: AbortSignal): Promise<NostrEvent | null> {
  try {
    const response = await fetch(`${API_CONFIG.funnelcake.baseUrl}/api/event/${encodeURIComponent(eventId)}`, {
      signal,
    });

    if (!response.ok) {
      return null;
    }

    return await response.json() as NostrEvent;
  } catch {
    return null;
  }
}

export async function fetchEventById(
  nostr: NostrQueryClient,
  eventId: string,
  signal: AbortSignal,
  options?: EventLookupOptions,
): Promise<NostrEvent | null> {
  const fromApi = await fetchEventByIdFromApi(eventId, signal);
  if (fromApi) {
    return fromApi;
  }

  const events = await nostr.query([{ ids: [eventId], limit: 1 }], {
    signal,
    relays: resolveEventLookupRelays(options),
  });
  return events[0] || null;
}

export async function fetchAddressableEvent(
  nostr: NostrQueryClient,
  ref: AddressableEventRef,
  signal: AbortSignal,
  options?: EventLookupOptions,
): Promise<NostrEvent | null> {
  const events = await nostr.query([{
    kinds: [ref.kind],
    authors: [ref.pubkey],
    '#d': [ref.identifier],
    limit: 5,
  }], {
    signal,
    relays: resolveEventLookupRelays(options),
  });

  return events.sort((a, b) => b.created_at - a.created_at)[0] || null;
}
