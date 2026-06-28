import React, { useEffect, useRef } from 'react';
import { NostrEvent, NostrFilter, NPool, NRelay1 } from '@nostrify/nostrify';
import { WebsocketEvent } from 'websocket-ts';
import { BADGE_RELAYS, PROFILE_RELAYS, getRelayUrls } from '@/config/relays';
import { NostrContext } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { debugLog, verboseLog } from '@/lib/debug';
import { createCachedNostr } from '@/lib/cachedNostr';
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
import { VIDEO_KINDS } from '@/types/video';

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

  // Update refs when config changes and close old relay connections
  useEffect(() => {
    const oldRelayUrls = relayUrls.current;
    relayUrl.current = config.relayUrl;
    relayUrls.current = config.relayUrls || [config.relayUrl];
    customRelayUrls.current = config.customRelayUrls ?? [];
    disabledPresetUrls.current = config.disabledPresetUrls ?? [];

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
  }, [config.relayUrl, config.relayUrls, config.customRelayUrls, config.disabledPresetUrls, queryClient]);

  // Initialize NPool only once
  if (!pool.current) {
    debugLog('[NostrProvider] Creating NPool instance');
    pool.current = new NPool({
      open(url: string) {
        verboseLog('[NostrProvider] Opening relay connection to:', url);
        const relay = new NRelay1(url, {
          idleTimeout: false, // Disable idle timeout to prevent premature connection closure
          // NRelay1 handles automatic reconnect via ExponentialBackoff(1000).
          // We record open/close/error events to feed the relayHealth score.
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
          // explicit recordReqEnd / recordPublish below.
        }

        // Wrap relay.req to record per-URL latency for the relayHealth score.
        // Time from REQ start to first EVENT or EOSE per relay. Errors land via
        // the socket listeners above and don't reset the timer.
        const innerReq = relay.req.bind(relay);
        (relay as { req: typeof innerReq }).req = async function* (
          filters: Parameters<typeof innerReq>[0],
          opts?: Parameters<typeof innerReq>[1],
        ) {
          recordReqStart(url);
          let resolved = false;
          try {
            for await (const msg of innerReq(filters, opts)) {
              if (!resolved && (msg[0] === 'EVENT' || msg[0] === 'EOSE')) {
                recordReqFirstResponse(url, msg[0] === 'EVENT');
                resolved = true;
              }
              yield msg;
            }
          } finally {
            if (!resolved) recordReqStartClear(url);
          }
        };

        verboseLog('[NostrProvider] NRelay1 instance created, readyState:', relay.socket?.readyState);
        return relay;
      },
      reqRouter(filters): ReadonlyMap<string, NostrFilter[]> {
        const result = new Map<string, NostrFilter[]>();

        const BADGE_KINDS = [30009, 8, 30008];
        const profileRelayFilters: NostrFilter[] = [];
        const badgeRelayFilters: NostrFilter[] = [];
        const videoFilters: NostrFilter[] = [];
        const otherFilters: NostrFilter[] = [];

        const isVideoKind = (kinds?: number[]) =>
          kinds?.some((k) => VIDEO_KINDS.includes(k)) ?? false;

        for (const filter of filters) {
          if (filter.kinds?.includes(0) || filter.kinds?.includes(3) || filter.kinds?.includes(10011)) {
            // Kind 0 (profile metadata), Kind 3 (contact lists), Kind 10011 (NIP-39 identities) - route to profile relays
            profileRelayFilters.push(filter);
          } else if (filter.kinds?.some((k) => BADGE_KINDS.includes(k))) {
            // NIP-58 badge events - route to badge relays
            badgeRelayFilters.push(filter);
          } else if (isVideoKind(filter.kinds)) {
            // Video kinds — adaptive pickTopN with sticky for the video kind
            videoFilters.push(filter);
          } else {
            // All other kinds (or id-only queries) - route to main relay
            otherFilters.push(filter);
          }
        }

        const disabled = new Set(disabledPresetUrls.current);
        const enabledProfileUrls = getRelayUrls(PROFILE_RELAYS).filter((u) => !disabled.has(u));
        const enabledBadgeUrls = getRelayUrls(BADGE_RELAYS).filter((u) => !disabled.has(u));

        // Route kind 0 and kind 3 queries to all enabled profile-specific relays for better availability
        if (profileRelayFilters.length > 0) {
          for (const relay of enabledProfileUrls) {
            result.set(relay, [...(result.get(relay) ?? []), ...profileRelayFilters]);
          }
        }

        // Route NIP-58 badge queries to top-3 enabled badge relays by score
        if (badgeRelayFilters.length > 0) {
          const picked = pickTopN(enabledBadgeUrls, 3);
          for (const relay of picked) {
            result.set(relay, [...(result.get(relay) ?? []), ...badgeRelayFilters]);
          }
        }

        // Route video filters adaptively with sticky for the video kind
        if (videoFilters.length > 0) {
          const videoKind = VIDEO_KINDS[0];
          const union = Array.from(
            new Set([
              ...relayUrls.current,
              ...customRelayUrls.current,
              ...enabledProfileUrls,
            ]),
          ).filter((u) => !disabled.has(u));
          const picked = pickTopN(union, 2, videoKind);
          for (const relay of picked) {
            result.set(relay, [...(result.get(relay) ?? []), ...videoFilters]);
            refreshSticky(relay, videoKind);
          }
        }

        // Route other queries adaptively across user's relays + custom
        if (otherFilters.length > 0) {
          const union = Array.from(
            new Set([
              ...relayUrls.current,
              ...customRelayUrls.current,
            ]),
          ).filter((u) => !disabled.has(u));
          const picked = pickTopN(union, 2);
          for (const relay of picked) {
            result.set(relay, [...(result.get(relay) ?? []), ...otherFilters]);
          }
        }

        // Fallback: if nothing was picked (e.g. all unhealthy), include the
        // user's selected relay so the app still functions.
        if (result.size === 0 && relayUrl.current) {
          result.set(relayUrl.current, filters);
        }

        return result as ReadonlyMap<string, NostrFilter[]>;
      },
      eventRouter(event: NostrEvent) {
        // Publish to the selected relay
        const disabled = new Set(disabledPresetUrls.current);
        const allRelays = new Set<string>([relayUrl.current]);

        // For profiles (kind 0), contact lists (kind 3), and identity claims (kind 10011), publish to multiple relays for better availability
        if (event.kind === 0 || event.kind === 3 || event.kind === 10011) {
          getRelayUrls(PROFILE_RELAYS)
            .filter((u) => !disabled.has(u))
            .forEach((url) => allRelays.add(url));
        }

        // For list events (kind 30000, 30001, 30005), publish to multiple relays for better discoverability
        const LIST_KINDS = [30000, 30001, 30005];
        if (LIST_KINDS.includes(event.kind)) {
          getRelayUrls(PROFILE_RELAYS)
            .filter((u) => !disabled.has(u))
            .forEach((url) => allRelays.add(url));
        }

        // Custom relays the user added
        for (const url of customRelayUrls.current) {
          if (!disabled.has(url)) allRelays.add(url);
        }

        // Also publish to the preset relays, capped to 5
        for (const { url } of (presetRelays ?? [])) {
          if (disabled.has(url)) continue;
          allRelays.add(url);

          if (allRelays.size >= 5) {
            break;
          }
        }

        const ranked = pickTopN(Array.from(allRelays), 5);
        for (const url of ranked) {
          // We mark publishes as success; failures land via recordError from
          // the relay socket events. This is a coarse approximation suitable
          // for adaptive ranking; an exact per-relay OK signal requires
          // wrapping publish() itself, which is out of scope for this iteration.
          recordPublish(url, true);
        }
        return ranked;
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
