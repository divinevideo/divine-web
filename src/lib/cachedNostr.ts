// ABOUTME: Cache-aware Nostr client wrapper that checks cache before querying relays
// ABOUTME: Supports gateway-first queries for relay.divine.video

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { eventCache } from './eventCache';
import { debugLog } from './debug';
import { shouldUseGateway, queryGateway } from './gatewayClient';

interface NostrClient {
  query: (filters: NostrFilter[], opts?: { signal?: AbortSignal }) => Promise<NostrEvent[]>;
  event: (event: NostrEvent) => Promise<void>;
}

interface CachedNostrOptions {
  getRelayUrl: () => string;
}

/**
 * Wrap a Nostr client with caching layer
 * Order: Local cache -> Gateway (for divine.video) -> WebSocket
 */
export function createCachedNostr<T extends NostrClient>(
  baseNostr: T,
  options: CachedNostrOptions
): T {
  const { getRelayUrl } = options;
  const cachedNostr = Object.create(baseNostr) as T;

  // Wrap query method with cache-first, gateway-second logic
  cachedNostr.query = async (filters: NostrFilter[], opts?: { signal?: AbortSignal }): Promise<NostrEvent[]> => {
    const startTime = performance.now();
    debugLog('[CachedNostr] Query with filters:', filters);

    const relayUrl = getRelayUrl();
    const useGateway = shouldUseGateway(relayUrl);

    // Check if this is a profile/contact query that should be cached
    const isProfileQuery = filters.some(f => f.kinds?.includes(0));
    const isContactQuery = filters.some(f => f.kinds?.includes(3));
    const isCacheable = isProfileQuery || isContactQuery;

    // 1. Try local cache first for cacheable queries
    if (isCacheable) {
      const cachedResults = await eventCache.query(filters);
      if (cachedResults.length > 0) {
        debugLog(`[CachedNostr] Cache hit: ${cachedResults.length} events in ${(performance.now() - startTime).toFixed(0)}ms`);

        // Background refresh via gateway or WebSocket
        _refreshInBackground(baseNostr.query.bind(baseNostr), filters, opts, useGateway);

        return cachedResults;
      } else {
        debugLog('[CachedNostr] Cache miss');
      }
    }

    // 2. Try gateway for ALL divine.video queries (not just cacheable)
    if (useGateway) {
      try {
        const gatewayStart = performance.now();
        debugLog('[CachedNostr] Trying gateway for divine.video query');
        const gatewayResults: NostrEvent[] = [];
        for (const filter of filters) {
          const events = await queryGateway(filter, opts?.signal);
          gatewayResults.push(...events);
        }

        // Gateway can return empty for valid queries (e.g., no matching events)
        // Only fall back to WebSocket if gateway throws an error
        debugLog(`[CachedNostr] Gateway returned ${gatewayResults.length} events in ${(performance.now() - gatewayStart).toFixed(0)}ms`);

        // Cache profile/contact results
        if (isCacheable && gatewayResults.length > 0) {
          await cacheResults(gatewayResults);
        }

        return gatewayResults;
      } catch (err) {
        debugLog(`[CachedNostr] Gateway failed after ${(performance.now() - startTime).toFixed(0)}ms, falling back to WebSocket:`, err);
      }
    }

    // 3. Fall back to WebSocket
    const wsStart = performance.now();
    const results = await baseNostr.query(filters, opts);
    debugLog(`[CachedNostr] WebSocket returned ${results.length} events in ${(performance.now() - wsStart).toFixed(0)}ms`);

    // Cache the results if cacheable
    if (isCacheable && results.length > 0) {
      await cacheResults(results);
    }

    return results;
  };

  // Wrap event method to cache published events
  cachedNostr.event = async (event: NostrEvent): Promise<void> => {
    // Publish to relay
    await baseNostr.event(event);

    // Cache the event
    await eventCache.event(event);
    debugLog('[CachedNostr] Event published and cached:', event.id);
  };

  return cachedNostr;
}

/**
 * Background refresh - uses gateway if available
 */
async function _refreshInBackground(
  queryFn: (filters: NostrFilter[], opts?: { signal?: AbortSignal }) => Promise<NostrEvent[]>,
  filters: NostrFilter[],
  opts?: { signal?: AbortSignal },
  useGateway?: boolean
): Promise<void> {
  try {
    let results: NostrEvent[];

    if (useGateway) {
      // Try gateway first for background refresh
      try {
        results = [];
        for (const filter of filters) {
          const events = await queryGateway(filter, opts?.signal);
          results.push(...events);
        }
      } catch {
        // Fall back to WebSocket for background refresh
        results = await queryFn(filters, opts);
      }
    } else {
      results = await queryFn(filters, opts);
    }

    await cacheResults(results);
    debugLog(`[CachedNostr] Background cache update: ${results.length} events`);
  } catch (err) {
    debugLog('[CachedNostr] Background cache update failed:', err);
  }
}

/**
 * Cache multiple events
 */
async function cacheResults(events: NostrEvent[]): Promise<void> {
  for (const event of events) {
    await eventCache.event(event);
  }
}
