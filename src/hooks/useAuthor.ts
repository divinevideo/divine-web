import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { eventCache, CACHE_TTL } from '@/lib/eventCache';

/**
 * Parse profile event content into metadata
 */
function parseProfileMetadata(event: NostrEvent): { event: NostrEvent; metadata?: NostrMetadata } {
  try {
    const metadata = n.json().pipe(n.metadata()).parse(event.content);
    return { metadata, event };
  } catch {
    return { event };
  }
}

export function useAuthor(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata }>({
    queryKey: ['author', pubkey ?? ''],

    queryFn: async ({ signal }) => {
      if (!pubkey) {
        return {};
      }

      // Query for profile events and take the newest one
      // 10s timeout to accommodate gateway REST API which is slower than direct WebSocket
      const events = await nostr.query(
        [{ kinds: [0], authors: [pubkey!], limit: 5 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) },
      );

      if (events.length === 0) {
        return {};
      }

      // Take the most recent event (kind 0 is replaceable)
      const event = events.sort((a, b) => b.created_at - a.created_at)[0];

      // Also add to event cache for future synchronous access
      eventCache.event(event).catch(() => {
        // Silently ignore cache errors
      });

      return parseProfileMetadata(event);
    },

    retry: 1,
    staleTime: CACHE_TTL.PROFILE,
    gcTime: CACHE_TTL.PROFILE * 6,
    refetchOnWindowFocus: true,
  });
}
