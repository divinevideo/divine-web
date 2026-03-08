import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { API_CONFIG } from '@/config/api';

interface NostrQueryClient {
  query: (filters: NostrFilter[], options: { signal: AbortSignal }) => Promise<NostrEvent[]>;
}

export interface AddressableEventRef {
  kind: number;
  pubkey: string;
  identifier: string;
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
): Promise<NostrEvent | null> {
  const fromApi = await fetchEventByIdFromApi(eventId, signal);
  if (fromApi) {
    return fromApi;
  }

  const events = await nostr.query([{ ids: [eventId], limit: 1 }], { signal });
  return events[0] || null;
}

export async function fetchAddressableEvent(
  nostr: NostrQueryClient,
  ref: AddressableEventRef,
  signal: AbortSignal,
): Promise<NostrEvent | null> {
  const events = await nostr.query([{
    kinds: [ref.kind],
    authors: [ref.pubkey],
    '#d': [ref.identifier],
    limit: 5,
  }], { signal });

  return events.sort((a, b) => b.created_at - a.created_at)[0] || null;
}
