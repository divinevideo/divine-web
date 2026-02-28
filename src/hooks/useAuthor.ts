import { useMemo } from 'react';
import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { eventCache, CACHE_TTL } from '@/lib/eventCache';
import { API_CONFIG } from '@/config/api';
import { fetchUserProfile } from '@/lib/funnelcakeClient';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { debugLog } from '@/lib/debug';

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

export interface UseAuthorOptions {
  /** Pre-cached name from Funnelcake video response — shown instantly while full profile loads */
  initialName?: string;
  /** Pre-cached avatar from Funnelcake video response */
  initialAvatar?: string;
}

export function useAuthor(pubkey: string | undefined, options?: UseAuthorOptions) {
  const { nostr } = useNostr();
  const apiUrl = API_CONFIG.funnelcake.baseUrl;

  // Build placeholder from Funnelcake-embedded data so we never show "Loading..."
  const placeholderData = useMemo(() => {
    if (!options?.initialName && !options?.initialAvatar) return undefined;
    return {
      metadata: {
        name: options.initialName,
        picture: options.initialAvatar,
      } as NostrMetadata,
    };
  }, [options?.initialName, options?.initialAvatar]);

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata }>({
    queryKey: ['author', pubkey ?? ''],

    queryFn: async ({ signal }) => {
      if (!pubkey) {
        return {};
      }

      // Try Funnelcake REST API first (fast, ~50ms)
      if (isFunnelcakeAvailable(apiUrl)) {
        try {
          debugLog(`[useAuthor] REST fetch for ${pubkey.slice(0, 8)}...`);
          const profile = await fetchUserProfile(apiUrl, pubkey, signal);

          if (profile) {
            const metadata: NostrMetadata = {
              name: profile.name,
              display_name: profile.display_name,
              picture: profile.picture,
              banner: profile.banner,
              about: profile.about,
              nip05: profile.nip05,
              lud16: profile.lud16,
              website: profile.website,
            };
            debugLog(`[useAuthor] REST got profile for ${pubkey.slice(0, 8)}...`);
            return { metadata };
          }
        } catch (err) {
          debugLog(`[useAuthor] REST failed for ${pubkey.slice(0, 8)}, falling back to WebSocket:`, err);
        }
      }

      // WebSocket fallback (slow, can take seconds)
      debugLog(`[useAuthor] WebSocket fetch for ${pubkey.slice(0, 8)}...`);

      const events = await nostr.query(
        [{ kinds: [0], authors: [pubkey!], limit: 5 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) },
      );

      if (events.length === 0) {
        debugLog(`[useAuthor] No profile found for ${pubkey.slice(0, 8)}...`);
        return {};
      }

      // Take the most recent event (kind 0 is replaceable)
      const event = events.sort((a, b) => b.created_at - a.created_at)[0];

      debugLog(`[useAuthor] WebSocket got profile for ${pubkey.slice(0, 8)}...`);

      // Also add to event cache for future synchronous access
      eventCache.event(event).catch(() => {
        // Silently ignore cache errors
      });

      return parseProfileMetadata(event);
    },

    // Show Funnelcake-cached name/avatar immediately while full profile loads in background
    placeholderData,

    retry: 2,
    retryDelay: 1000,
    staleTime: CACHE_TTL.PROFILE,
    gcTime: CACHE_TTL.PROFILE * 6,
    refetchOnWindowFocus: true,
  });
}
