import React, { useEffect, useRef } from 'react';
import { NPool, NRelay1 } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { debugLog, verboseLog } from '@/lib/debug';
import { createCachedNostr } from '@/lib/cachedNostr';
import { buildEventRouter, buildReqRouter } from '@/lib/relayRouting';

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
      reqRouter: buildReqRouter({
        get relayUrl() { return relayUrl.current; },
        get relayUrls() { return relayUrls.current; },
        presetRelays,
      }),
      eventRouter: buildEventRouter({
        get relayUrl() { return relayUrl.current; },
        get relayUrls() { return relayUrls.current; },
        presetRelays,
      }),
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