// ABOUTME: Cache-aware Nostr client wrapper that checks cache before querying relays
// ABOUTME: Provides local caching for profile and contact queries

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { NSet } from '@nostrify/nostrify';
import { PRIMARY_RELAY } from '@/config/relays';
import { eventCache } from './eventCache';
import { debugLog } from './debug';
import { isListPublication } from '@/lib/publishListToPrimary';
import {
  LIST_KINDS,
  buildListDeletionFilters,
  excludeDeletedListEvents,
} from '@/lib/listEventDeletions';

export interface CachedNostrQueryOptions {
  signal?: AbortSignal;
  relays?: string[];
  requireComplete?: boolean;
}

interface CachedNostrOptions {
  getReadRoutes?: (filters: NostrFilter[]) => ReadonlyMap<string, NostrFilter[]>;
}

interface NostrClient {
  query: (filters: NostrFilter[], opts?: CachedNostrQueryOptions) => Promise<NostrEvent[]>;
  event: (event: NostrEvent, opts?: { signal?: AbortSignal; relays?: string[] }) => Promise<void>;
}

async function queryListPhase(client: NostrClient, filters: NostrFilter[], opts?: CachedNostrQueryOptions): Promise<NostrEvent[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  const signal = opts?.signal ? AbortSignal.any([opts.signal, controller.signal]) : controller.signal;
  try {
    const events = await client.query(filters, { ...opts, signal });
    if (opts?.requireComplete) signal.throwIfAborted();
    return events;
  } finally {
    clearTimeout(timer);
  }
}

async function queryWithCallerDeadline(client: NostrClient, filters: NostrFilter[], opts?: CachedNostrQueryOptions): Promise<NostrEvent[]> {
  const signal = opts?.signal ?? AbortSignal.timeout(5000);
  const events = await client.query(filters, { ...opts, signal });
  if (opts?.requireComplete) signal.throwIfAborted();
  return events;
}

function isPrimaryRelay(url: string): boolean {
  try {
    return new URL(url).href === new URL(PRIMARY_RELAY.url).href;
  } catch {
    return false;
  }
}

async function queryListSources(
  client: NostrClient,
  filters: NostrFilter[],
  opts: CachedNostrQueryOptions | undefined,
  getReadRoutes: CachedNostrOptions['getReadRoutes'],
): Promise<NostrEvent[]> {
  const routes = opts?.relays
    ? new Map(opts.relays.map(url => [url, filters]))
    : getReadRoutes?.(filters);
  if (!routes) return queryWithCallerDeadline(client, filters, opts);

  const controller = new AbortController();
  const signal = AbortSignal.any([opts?.signal ?? AbortSignal.timeout(5000), controller.signal]);
  const primaryFilters = new Set<NostrFilter>();
  const requests: Promise<NostrEvent[]>[] = [];
  for (const [url, relayFilters] of routes) {
    if (isPrimaryRelay(url)) {
      relayFilters.forEach(filter => primaryFilters.add(filter));
    } else {
      const recovery = relayFilters.every(filter => filter.authors?.length &&
        filter.kinds?.every(kind => LIST_KINDS.includes(kind)));
      const query = recovery ? queryListPhase : queryWithCallerDeadline;
      requests.push(query(client, relayFilters, { ...opts, signal, relays: [url] }));
    }
  }
  if (primaryFilters.size > 0) {
    requests.push(queryWithCallerDeadline(client, [...primaryFilters], { ...opts, signal, relays: [PRIMARY_RELAY.url] }));
  }
  try {
    const snapshots = opts?.requireComplete
      ? await Promise.all(requests)
      : (await Promise.allSettled(requests)).flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    const merged = new NSet();
    for (const event of snapshots.flat()) merged.add(event);
    return Array.from(merged.values());
  } finally {
    controller.abort();
  }
}

async function readLocalListDeletions(filters: NostrFilter[], signal?: AbortSignal): Promise<NostrEvent[]> {
  let timer!: ReturnType<typeof setTimeout>;
  let cancel!: () => void;
  const deadline = new Promise<NostrEvent[]>(resolve => {
    cancel = () => {
      clearTimeout(timer);
      timer = setTimeout(() => resolve([]), 0);
    };
    timer = setTimeout(() => resolve([]), signal?.aborted ? 0 : 1500);
    signal?.addEventListener('abort', cancel, { once: true });
  });
  try {
    return await Promise.race([eventCache.query(filters).catch((): NostrEvent[] => []), deadline]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

/**
 * Wrap a Nostr client with caching layer
 * Order: Local cache -> WebSocket
 */
export function createCachedNostr<T extends NostrClient>(
  baseNostr: T,
  options: CachedNostrOptions = {},
): T {
  const cachedNostr = Object.create(baseNostr) as T;

  // Wrap query method with cache-first logic
  cachedNostr.query = async (filters: NostrFilter[], opts?: CachedNostrQueryOptions): Promise<NostrEvent[]> => {
    const startTime = performance.now();
    // debugLog('[CachedNostr] Query with filters:', filters);

    // Check if this is a profile/contact query that should be cached
    const isProfileQuery = filters.some(f => f.kinds?.includes(0));
    const isContactQuery = filters.some(f => f.kinds?.includes(3));
    const isCacheable = isProfileQuery || isContactQuery;

    // 1. Try local cache first for cacheable queries
    if (isCacheable) {
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
    const isListRead = filters.some(filter => filter.kinds?.some(kind => LIST_KINDS.includes(kind)));
    const response = isListRead ? await queryListSources(baseNostr, filters, opts, options.getReadRoutes) : await baseNostr.query(filters, opts);
    let results = response;
    const deletionFilters = buildListDeletionFilters(results);
    if (deletionFilters.length > 0) {
      const [localDeletions, deletions] = await Promise.all([
        readLocalListDeletions(deletionFilters, opts?.signal),
        opts?.signal?.aborted ? [] : queryListPhase(baseNostr, deletionFilters, opts),
      ]);
      results = excludeDeletedListEvents(results, [...response, ...localDeletions, ...deletions]);
    }
    if (opts?.requireComplete) opts.signal?.throwIfAborted();
    // debugLog(`[CachedNostr] WebSocket returned ${results.length} events in ${(performance.now() - _wsStart).toFixed(0)}ms`);

    // Cache the results if cacheable
    if (isCacheable && results.length > 0) {
      await cacheResults(results);
    }

    return results;
  };

  // Wrap event method to cache published events
  cachedNostr.event = async (event: NostrEvent, opts?: { signal?: AbortSignal; relays?: string[] }): Promise<void> => {
    // Publish to relay
    await baseNostr.event(event, opts);

    // Cache the event
    const cacheWrite = eventCache.event(event);
    if (isListPublication(event)) {
      void cacheWrite.catch(error => debugLog('[CachedNostr] Local event cache write failed:', error));
    } else {
      await cacheWrite;
    }
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
