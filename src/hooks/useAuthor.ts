import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { eventCache } from '@/lib/eventCache';

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

      const [event] = await nostr.query(
        [{ kinds: [0], authors: [pubkey!], limit: 1 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) },
      );

      if (!event) {
        // Return empty object instead of throwing error
        // This allows components to use fallback display names
        return {};
      }

      // Also add to event cache for future synchronous access
      eventCache.event(event).catch(() => {
        // Silently ignore cache errors
      });

      return parseProfileMetadata(event);
    },

    // Use cached profile as initialData for instant rendering
    initialData: () => {
      if (!pubkey) return undefined;

      const cachedEvent = eventCache.getCachedProfile(pubkey);
      if (cachedEvent) {
        return parseProfileMetadata(cachedEvent);
      }

      return undefined;
    },

    retry: 1, // Reduce retries since many profiles don't exist
    staleTime: 30 * 60 * 1000, // Cache for 30 minutes (increased from 5 minutes)
    gcTime: 2 * 60 * 60 * 1000, // Keep in cache for 2 hours (increased from 30 minutes)
  });
}
