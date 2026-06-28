import React, { useEffect, useMemo, useRef } from 'react';
import { NPool, NRelay1 } from '@nostrify/nostrify';
import { WebsocketEvent } from 'websocket-ts';

import { NostrContext } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { debugLog, verboseLog } from '@/lib/debug';
import { createCachedNostr } from '@/lib/cachedNostr';
import { buildEventRouter, buildReqRouter } from '@/lib/relayRouting';
import {
  pickTopN,
  recordClose,
  recordError,
  recordOpen,
  recordPublish,
  recordReqFirstResponse,
  recordReqStart,
  recordReqStartClear,
  refreshSticky,
  reset as resetRelayHealth,
  snapshot as relayHealthSnapshot,
} from '@/lib/relayHealth';

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
  const customRelayUrls = useRef<string[]>(config.customRelayUrls ?? []);
  const disabledPresetUrls = useRef<string[]>(config.disabledPresetUrls ?? []);

  const enabledRoutingUrls = useMemo(() => {
    const disabled = new Set(config.disabledPresetUrls ?? []);
    return Array.from(
      new Set([
        ...(config.relayUrls || [config.relayUrl]),
        ...(config.customRelayUrls ?? []),
      ]),
    ).filter((url) => !disabled.has(url));
  }, [config.customRelayUrls, config.disabledPresetUrls, config.relayUrl, config.relayUrls]);

  // Update refs when config changes and close old relay connections
  useEffect(() => {
    const oldEnabledRoutingUrls = Array.from(
      new Set([...relayUrls.current, ...customRelayUrls.current]),
    ).filter((url) => !disabledPresetUrls.current.includes(url));
    relayUrl.current = config.relayUrl;
    relayUrls.current = config.relayUrls || [config.relayUrl];
    customRelayUrls.current = config.customRelayUrls ?? [];
    disabledPresetUrls.current = config.disabledPresetUrls ?? [];

    const routingUrlsChanged =
      JSON.stringify(oldEnabledRoutingUrls) !== JSON.stringify(enabledRoutingUrls);
    if (routingUrlsChanged && pool.current) {
      debugLog('[NostrProvider] Relays changed from', oldEnabledRoutingUrls, 'to', enabledRoutingUrls);

      for (const oldUrl of oldEnabledRoutingUrls) {
        if (!enabledRoutingUrls.includes(oldUrl)) {
          const oldRelay = pool.current.relays.get(oldUrl);
          if (oldRelay) {
            debugLog('[NostrProvider] Closing old relay connection:', oldUrl);
            oldRelay.close();
          }
        }
      }

      for (const url of enabledRoutingUrls) {
        debugLog('[NostrProvider] Opening relay connection:', url);
        pool.current.relay(url);
      }

      queryClient.resetQueries();
    }
  }, [
    config.relayUrl,
    config.relayUrls,
    config.customRelayUrls,
    config.disabledPresetUrls,
    enabledRoutingUrls,
    queryClient,
  ]);

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
        try {
          const socket = relay.socket;
          if (socket) {
            socket.addEventListener(WebsocketEvent.open, () => recordOpen(url));
            socket.addEventListener(WebsocketEvent.close, (_instance, ev) => {
              recordClose(url, ev?.wasClean === true);
            });
            socket.addEventListener(WebsocketEvent.error, () => recordError(url));
          }
        } catch {
          // socket wiring is best-effort; we still get telemetry from
          // req/publish wrappers below.
        }

        // Wrap relay.req to record per-URL latency for the relayHealth score.
        // Time from REQ start to first EVENT or EOSE per relay. Errors land via
        // the socket listeners above and don't reset the timer.
        const innerReq = relay.req.bind(relay);
        (relay as { req: typeof innerReq }).req = async function* (
          filters: Parameters<typeof innerReq>[0],
          opts?: Parameters<typeof innerReq>[1],
        ) {
          const reqHandle = recordReqStart(url);
          let resolved = false;
          try {
            for await (const msg of innerReq(filters, opts)) {
              if (!resolved && (msg[0] === 'EVENT' || msg[0] === 'EOSE')) {
                recordReqFirstResponse(reqHandle, true);
                resolved = true;
              } else if (!resolved && msg[0] === 'CLOSED') {
                recordReqFirstResponse(reqHandle, false);
                resolved = true;
              }
              yield msg;
            }
          } finally {
            if (!resolved) recordReqStartClear(reqHandle);
          }
        };

        const innerEvent = relay.event.bind(relay);
        (relay as { event: typeof innerEvent }).event = async (
          event: Parameters<typeof innerEvent>[0],
          opts?: Parameters<typeof innerEvent>[1],
        ) => {
          try {
            await innerEvent(event, opts);
            recordPublish(url, true);
          } catch (error) {
            recordPublish(url, false);
            throw error;
          }
        };

        verboseLog('[NostrProvider] NRelay1 instance created, readyState:', relay.socket?.readyState);
        return relay;
      },
      reqRouter: buildReqRouter({
        get relayUrl() { return relayUrl.current; },
        get relayUrls() { return relayUrls.current; },
        get customRelayUrls() { return customRelayUrls.current; },
        get disabledPresetUrls() { return disabledPresetUrls.current; },
        presetRelays,
        pickTopN,
        refreshSticky,
      }),
      eventRouter: buildEventRouter({
        get relayUrl() { return relayUrl.current; },
        get relayUrls() { return relayUrls.current; },
        get customRelayUrls() { return customRelayUrls.current; },
        get disabledPresetUrls() { return disabledPresetUrls.current; },
        presetRelays,
        pickTopN,
      }),
    });

    // Wrap with caching layer for profile/contact queries
    cachedPool.current = createCachedNostr(pool.current);
    debugLog('[NostrProvider] Wrapped NPool with caching layer');

    // Pre-establish WebSocket connections synchronously
    // This ensures the connections start BEFORE any child components query
    debugLog('[NostrProvider] Pre-warming connections to:', enabledRoutingUrls);
    for (const url of enabledRoutingUrls) {
      pool.current.relay(url);
    }
    debugLog('[NostrProvider] Connections initiated');

    // Dev-only stats surface. Enabled when running in dev mode or when the
    // user has explicitly opted in via localStorage. Production users see
    // nothing; dev can inspect window.__DIVINE_RELAY_STATS__ in the console.
    if (typeof window !== 'undefined') {
      const enabled =
        import.meta.env.DEV ||
        window.localStorage.getItem('divine.debug.relays') === '1';
      if (enabled) {
        (window as unknown as { __DIVINE_RELAY_STATS__?: unknown }).__DIVINE_RELAY_STATS__ = {
          snapshot: () => relayHealthSnapshot(),
          reset: () => resetRelayHealth(),
          pickTopN: (urls: string[], n: number, kind?: number) => pickTopN(urls, n, kind),
        };
      }
    }
  }

  return (
    <NostrContext.Provider value={{ nostr: cachedPool.current || pool.current }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;
