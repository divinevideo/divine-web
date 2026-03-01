import React, { useEffect, useRef } from 'react';
import { NostrEvent, NostrFilter, NPool, NRelay1 } from '@nostrify/nostrify';
import { BADGE_RELAYS } from '@/config/relays';
import { NostrContext } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { debugLog, verboseLog } from '@/lib/debug';
import { createCachedNostr } from '@/lib/cachedNostr';
import { PROFILE_RELAYS, getRelayUrls } from '@/config/relays';

interface NostrProviderProps {
  children: React.ReactNode;
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children } = props;
  const { config, presetRelays } = useAppContext();

  const queryClient = useQueryClient();

  // Create NPool instance only once
  const pool = useRef<NPool | undefined>(undefined);
  const cachedPool = useRef<NPool | undefined>(undefined);

  // Use refs so the pool always has the latest data
  const relayUrl = useRef<string>(config.relayUrl);
  const relayUrls = useRef<string[]>(config.relayUrls || [config.relayUrl]);

  // Update refs when config changes and close old relay connections
  useEffect(() => {
    const oldRelayUrls = relayUrls.current;
    relayUrl.current = config.relayUrl;
    relayUrls.current = config.relayUrls || [config.relayUrl];

    // If relay URLs changed, close old connections and reset queries
    const urlsChanged = JSON.stringify(oldRelayUrls) !== JSON.stringify(relayUrls.current);
    if (urlsChanged && pool.current) {
      debugLog('[NostrProvider] Relays changed from', oldRelayUrls, 'to', relayUrls.current);

      // Close old relay connections that are no longer in the list
      for (const oldUrl of oldRelayUrls) {
        if (!relayUrls.current.includes(oldUrl)) {
          const oldRelay = pool.current.relays.get(oldUrl);
          if (oldRelay) {
            debugLog('[NostrProvider] Closing old relay connection:', oldUrl);
            oldRelay.close();
          }
        }
      }

      // Pre-warm new relay connections
      for (const url of relayUrls.current) {
        debugLog('[NostrProvider] Opening relay connection:', url);
        pool.current.relay(url);
      }

      // Reset all queries to fetch fresh data from new relays
      queryClient.resetQueries();
    }
  }, [config.relayUrl, config.relayUrls, queryClient]);

  // Initialize NPool only once
  if (!pool.current) {
    debugLog('[NostrProvider] Creating NPool instance');
    pool.current = new NPool({
      open(url: string) {
        verboseLog('[NostrProvider] Opening relay connection to:', url);
        const relay = new NRelay1(url, {
          idleTimeout: false, // Disable idle timeout to prevent premature connection closure
          // Disabled to reduce console noise - enable for debugging relay issues
          // log: (log) => verboseLog(`[NRelay1:${log.ns}]`, log),
        });
        verboseLog('[NostrProvider] NRelay1 instance created, readyState:', relay.socket?.readyState);
        return relay;
      },
      reqRouter(filters): ReadonlyMap<string, NostrFilter[]> {
        // debugLog('[NostrProvider] ========== reqRouter called ==========');
        // debugLog('[NostrProvider] Filters:', filters);

        const result = new Map<string, NostrFilter[]>();

        // Separate filters by kind for kind-specific relay routing
        const profileRelayFilters: NostrFilter[] = []; // Kind 0 (profiles) and Kind 3 (contact lists)
        const badgeRelayFilters: NostrFilter[] = []; // Kind 30009, 8, 30008 (NIP-58 badges)
        const otherFilters: NostrFilter[] = [];

        const BADGE_KINDS = [30009, 8, 30008];

        for (const filter of filters) {
          if (filter.kinds?.includes(0) || filter.kinds?.includes(3)) {
            // Kind 0 (profile metadata) and Kind 3 (contact lists) - route to profile relays
            profileRelayFilters.push(filter);
          } else if (filter.kinds?.some(k => BADGE_KINDS.includes(k))) {
            // NIP-58 badge events - route to badge relays
            badgeRelayFilters.push(filter);
          } else {
            // All other kinds (or id-only queries) - route to main relay
            otherFilters.push(filter);
          }
        }

        // Route kind 0 and kind 3 queries to profile-specific relays for better availability
        if (profileRelayFilters.length > 0) {
          const profileRelayUrls = getRelayUrls(PROFILE_RELAYS);

          // debugLog(`[NostrProvider] Routing ${profileRelayFilters.length} profile/contact filters to ${profileRelayUrls.length} relays`);

          for (const relay of profileRelayUrls) {
            result.set(relay, profileRelayFilters);
          }
        }

        // Route NIP-58 badge queries to badge-specific relays
        if (badgeRelayFilters.length > 0) {
          for (const relay of BADGE_RELAYS) {
            const existing = result.get(relay.url) || [];
            result.set(relay.url, [...existing, ...badgeRelayFilters]);
          }
        }

        // Route other queries to all configured relays
        if (otherFilters.length > 0) {
          // Query all configured relays
          for (const url of relayUrls.current) {
            result.set(url, otherFilters);
          }
        }

        // debugLog('[NostrProvider] Router result:', Array.from(result.entries()));
        return result as ReadonlyMap<string, NostrFilter[]>;
      },
      eventRouter(event: NostrEvent) {
        // Publish to the selected relay
        const allRelays = new Set<string>([relayUrl.current]);

        // For contact lists (kind 3), publish to multiple relays for better availability
        if (event.kind === 3) {
          // Add common relays where contact lists should be stored
          getRelayUrls(PROFILE_RELAYS).forEach(url => allRelays.add(url));
        }

        // For list events (kind 30000, 30001, 30005), publish to multiple relays for better discoverability
        const LIST_KINDS = [30000, 30001, 30005];
        if (LIST_KINDS.includes(event.kind)) {
          // Add common relays where lists should be stored
          getRelayUrls(PROFILE_RELAYS).forEach(url => allRelays.add(url));
        }

        // Also publish to the preset relays, capped to 5
        for (const { url } of (presetRelays ?? [])) {
          allRelays.add(url);

          if (allRelays.size >= 5) {
            break;
          }
        }

        return [...allRelays];
      },
    });

    // Wrap with caching layer for profile/contact queries
    cachedPool.current = createCachedNostr(pool.current);
    debugLog('[NostrProvider] Wrapped NPool with caching layer');

    // Pre-establish WebSocket connections synchronously
    // This ensures the connections start BEFORE any child components query
    debugLog('[NostrProvider] Pre-warming connections to:', relayUrls.current);
    for (const url of relayUrls.current) {
      pool.current.relay(url);
    }
    debugLog('[NostrProvider] Connections initiated');
  }

  return (
    <NostrContext.Provider value={{ nostr: cachedPool.current || pool.current }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;