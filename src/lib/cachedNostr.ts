// ABOUTME: Cache-aware Nostr client wrapper that checks cache before querying relays
// ABOUTME: Provides local caching for profile and contact queries

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { eventCache } from './eventCache';
import { debugLog } from './debug';

/**
 * Query options accepted by the cached client. `bypassCache` lets a caller
 * skip the local cache-first short-circuit and force an authoritative relay
 * read (the fresh result is still written back to the cache).
 */
export interface CachedQueryOptions {
  signal?: AbortSignal;
  relays?: string[];
  bypassCache?: boolean;
}

interface NostrClient {
  query: (filters: NostrFilter[], opts?: CachedQueryOptions) => Promise<NostrEvent[]>;
  event: (event: NostrEvent) => Promise<void>;
}

export type CachedNostrClient<T extends NostrClient = NostrClient> = T & {
  query: (filters: NostrFilter[], opts?: CachedQueryOptions) => Promise<NostrEvent[]>;
};

/**
 * Wrap a Nostr client with caching layer
 * Order: Local cache -> WebSocket
 */
export function createCachedNostr<T extends NostrClient>(
  baseNostr: T
): CachedNostrClient<T> {
  const cachedNostr = Object.create(baseNostr) as CachedNostrClient<T>;

  // Wrap query method with cache-first logic
  cachedNostr.query = async (filters: NostrFilter[], opts?: CachedQueryOptions): Promise<NostrEvent[]> => {
    const startTime = performance.now();
    // debugLog('[CachedNostr] Query with filters:', filters);

    // Check if this is a profile/contact query that should be cached
    const isProfileQuery = filters.some(f => f.kinds?.includes(0));
    const isContactQuery = filters.some(f => f.kinds?.includes(3));
    const isCacheable = isProfileQuery || isContactQuery;

    // 1. Try local cache first for cacheable queries.
    //    `bypassCache` callers skip this short-circuit so they read the
    //    authoritative event from the relay (e.g. a read-before-write that
    //    must not be served a stale cached list). The fresh relay result is
    //    still cached below.
    if (isCacheable && !opts?.bypassCache) {
      const cachedResults = await eventCache.query(filters);
      if (cachedResults.length > 0) {
        debugLog(`[CachedNostr] Cache hit: ${cachedResults.length} events in ${(performance.now() - startTime).toFixed(0)}ms`);

        // Background refresh via WebSocket
        _refreshInBackground(baseNostr.query.bind(baseNostr), filters, opts);

        return cachedResults;
      } else {
        debugLog('[CachedNostr] Cache miss');
      }
    }

    // 2. Query via WebSocket
    const _wsStart = performance.now();
    const results = await baseNostr.query(filters, opts);
    // debugLog(`[CachedNostr] WebSocket returned ${results.length} events in ${(performance.now() - _wsStart).toFixed(0)}ms`);

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
 * Background refresh via WebSocket
 */
async function _refreshInBackground(
  queryFn: (filters: NostrFilter[], opts?: { signal?: AbortSignal; relays?: string[] }) => Promise<NostrEvent[]>,
  filters: NostrFilter[],
  opts?: { signal?: AbortSignal; relays?: string[] }
): Promise<void> {
  try {
    const results = await queryFn(filters, opts);
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
