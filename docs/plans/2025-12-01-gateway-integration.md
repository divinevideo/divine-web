# Divine REST Gateway Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add REST gateway as a fast middle layer between local cache and WebSocket relay for relay.divine.video queries.

**Architecture:** Extend cachedNostr to try local cache first, then gateway.divine.video REST API, then fall back to WebSocket. Gateway is read-only; writes still go through WebSocket.

**Tech Stack:** TypeScript, fetch API, existing @nostrify/nostrify types

---

## Task 1: Create Gateway Client Module

**Files:**
- Create: `src/lib/gatewayClient.ts`
- Test: `src/lib/gatewayClient.test.ts`

**Step 1: Write the failing test for shouldUseGateway**

Create `src/lib/gatewayClient.test.ts`:

```typescript
// ABOUTME: Tests for Divine REST Gateway client
// ABOUTME: Verifies gateway detection and query encoding

import { describe, it, expect } from 'vitest';
import { shouldUseGateway, encodeFilter } from './gatewayClient';

describe('shouldUseGateway', () => {
  it('returns true for relay.divine.video', () => {
    expect(shouldUseGateway('wss://relay.divine.video')).toBe(true);
    expect(shouldUseGateway('wss://relay.divine.video/')).toBe(true);
  });

  it('returns false for other relays', () => {
    expect(shouldUseGateway('wss://relay.damus.io')).toBe(false);
    expect(shouldUseGateway('wss://relay.nostr.band')).toBe(false);
  });
});

describe('encodeFilter', () => {
  it('encodes filter to base64url format', () => {
    const filter = { kinds: [1], limit: 10 };
    const encoded = encodeFilter(filter);

    // Should be base64url (no +, /, or = characters)
    expect(encoded).not.toMatch(/[+/=]/);

    // Should decode back to original
    const decoded = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    expect(decoded).toEqual(filter);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/gatewayClient.test.ts`

Expected: FAIL with "Cannot find module './gatewayClient'"

**Step 3: Write minimal implementation**

Create `src/lib/gatewayClient.ts`:

```typescript
// ABOUTME: Divine REST Gateway client for fast cached queries
// ABOUTME: Provides HTTP-based access to relay.divine.video data

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { debugLog, debugError } from './debug';

const GATEWAY_URL = 'https://gateway.divine.video';
const GATEWAY_TIMEOUT_MS = 3000;

/**
 * Check if a relay URL should use the gateway
 */
export function shouldUseGateway(relayUrl: string): boolean {
  try {
    const url = new URL(relayUrl);
    return url.hostname === 'relay.divine.video';
  } catch {
    return false;
  }
}

/**
 * Encode a Nostr filter to base64url format for gateway API
 */
export function encodeFilter(filter: NostrFilter): string {
  const json = JSON.stringify(filter);
  const base64 = btoa(json);
  // Convert to base64url: replace + with -, / with _, remove =
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

interface GatewayResponse {
  events: NostrEvent[];
  cached: boolean;
  cache_age_seconds?: number;
}

/**
 * Query the gateway REST API
 * Returns events or throws on error
 */
export async function queryGateway(
  filter: NostrFilter,
  signal?: AbortSignal
): Promise<NostrEvent[]> {
  const encoded = encodeFilter(filter);
  const url = `${GATEWAY_URL}/query?filter=${encoded}`;

  debugLog('[GatewayClient] Querying:', url);

  const timeoutSignal = AbortSignal.timeout(GATEWAY_TIMEOUT_MS);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  const response = await fetch(url, { signal: combinedSignal });

  if (!response.ok) {
    throw new Error(`Gateway error: ${response.status} ${response.statusText}`);
  }

  const data: GatewayResponse = await response.json();

  debugLog(`[GatewayClient] Got ${data.events.length} events (cached: ${data.cached}, age: ${data.cache_age_seconds}s)`);

  return data.events;
}

/**
 * Fetch a single event by ID from gateway
 */
export async function getEventFromGateway(
  eventId: string,
  signal?: AbortSignal
): Promise<NostrEvent | null> {
  const url = `${GATEWAY_URL}/event/${eventId}`;

  debugLog('[GatewayClient] Fetching event:', eventId);

  const timeoutSignal = AbortSignal.timeout(GATEWAY_TIMEOUT_MS);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  try {
    const response = await fetch(url, { signal: combinedSignal });
    if (!response.ok) return null;

    const data: GatewayResponse = await response.json();
    return data.events[0] || null;
  } catch (err) {
    debugError('[GatewayClient] Failed to fetch event:', err);
    return null;
  }
}

/**
 * Fetch a profile by pubkey from gateway
 */
export async function getProfileFromGateway(
  pubkey: string,
  signal?: AbortSignal
): Promise<NostrEvent | null> {
  const url = `${GATEWAY_URL}/profile/${pubkey}`;

  debugLog('[GatewayClient] Fetching profile:', pubkey);

  const timeoutSignal = AbortSignal.timeout(GATEWAY_TIMEOUT_MS);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  try {
    const response = await fetch(url, { signal: combinedSignal });
    if (!response.ok) return null;

    const data: GatewayResponse = await response.json();
    return data.events[0] || null;
  } catch (err) {
    debugError('[GatewayClient] Failed to fetch profile:', err);
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/gatewayClient.test.ts`

Expected: PASS (2 test suites)

**Step 5: Commit**

```bash
git add src/lib/gatewayClient.ts src/lib/gatewayClient.test.ts
git commit -m "feat: add Divine REST Gateway client module"
```

---

## Task 2: Add Gateway Query Tests

**Files:**
- Modify: `src/lib/gatewayClient.test.ts`

**Step 1: Add integration test for queryGateway**

Add to `src/lib/gatewayClient.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shouldUseGateway, encodeFilter, queryGateway } from './gatewayClient';

// ... existing tests ...

describe('queryGateway', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('makes request to gateway with encoded filter', async () => {
    const mockEvents = [{ id: 'test', kind: 1, pubkey: 'abc', created_at: 123, tags: [], content: '', sig: '' }];

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: mockEvents, cached: true, cache_age_seconds: 10 })
    });

    const filter = { kinds: [1], limit: 5 };
    const result = await queryGateway(filter);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://gateway.divine.video/query?filter='),
      expect.any(Object)
    );
    expect(result).toEqual(mockEvents);
  });

  it('throws on gateway error response', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    await expect(queryGateway({ kinds: [1] })).rejects.toThrow('Gateway error: 500');
  });

  it('returns empty array when gateway returns no events', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [], cached: false })
    });

    const result = await queryGateway({ kinds: [1] });
    expect(result).toEqual([]);
  });
});
```

**Step 2: Run tests**

Run: `npm test -- src/lib/gatewayClient.test.ts`

Expected: PASS (all tests)

**Step 3: Commit**

```bash
git add src/lib/gatewayClient.test.ts
git commit -m "test: add queryGateway unit tests with mocked fetch"
```

---

## Task 3: Update cachedNostr to Accept Relay URL

**Files:**
- Modify: `src/lib/cachedNostr.ts`
- Modify: `src/components/NostrProvider.tsx`

**Step 1: Update createCachedNostr signature**

Modify `src/lib/cachedNostr.ts` - change the function signature to accept relay URL getter:

```typescript
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
        debugLog(`[CachedNostr] Cache hit: ${cachedResults.length} events`);

        // Background refresh via gateway or WebSocket
        _refreshInBackground(baseNostr.query.bind(baseNostr), filters, opts, useGateway);

        return cachedResults;
      } else {
        debugLog('[CachedNostr] Cache miss');
      }
    }

    // 2. Try gateway if targeting divine.video
    if (useGateway) {
      try {
        debugLog('[CachedNostr] Trying gateway for divine.video query');
        // Query each filter separately and combine results
        const gatewayResults: NostrEvent[] = [];
        for (const filter of filters) {
          const events = await queryGateway(filter, opts?.signal);
          gatewayResults.push(...events);
        }

        if (gatewayResults.length > 0) {
          debugLog(`[CachedNostr] Gateway returned ${gatewayResults.length} events`);
          // Cache the results
          if (isCacheable) {
            await cacheResults(gatewayResults);
          }
          return gatewayResults;
        }
        debugLog('[CachedNostr] Gateway returned empty, falling back to WebSocket');
      } catch (err) {
        debugLog('[CachedNostr] Gateway failed, falling back to WebSocket:', err);
      }
    }

    // 3. Fall back to WebSocket
    const results = await baseNostr.query(filters, opts);
    debugLog(`[CachedNostr] Relay returned ${results.length} events`);

    // Cache the results if cacheable
    if (isCacheable && results.length > 0) {
      await cacheResults(results);
    }

    return results;
  };

  // Wrap event method to cache published events (unchanged)
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
```

**Step 2: Update NostrProvider to pass relay URL**

Modify `src/components/NostrProvider.tsx` line 148, change:

```typescript
    // Wrap with caching layer
    cachedPool.current = createCachedNostr(pool.current);
```

To:

```typescript
    // Wrap with caching layer - pass relay URL getter for gateway detection
    cachedPool.current = createCachedNostr(pool.current, {
      getRelayUrl: () => relayUrl.current
    });
```

**Step 3: Run the app to verify it works**

Run: `npm run dev`

Open browser, check console for `[CachedNostr] Trying gateway` logs when viewing videos.

**Step 4: Commit**

```bash
git add src/lib/cachedNostr.ts src/components/NostrProvider.tsx
git commit -m "feat: integrate gateway into cachedNostr query flow"
```

---

## Task 4: Enable Gateway for All Query Types (Not Just Profile/Contact)

**Files:**
- Modify: `src/lib/cachedNostr.ts`

**Step 1: Update query logic to use gateway for all divine.video queries**

The current implementation only tries gateway after cache for `isCacheable` queries. Update to try gateway for ALL queries to divine.video:

In `src/lib/cachedNostr.ts`, update the query method:

```typescript
  cachedNostr.query = async (filters: NostrFilter[], opts?: { signal?: AbortSignal }): Promise<NostrEvent[]> => {
    debugLog('[CachedNostr] Query with filters:', filters);

    const relayUrl = getRelayUrl();
    const useGateway = shouldUseGateway(relayUrl);

    // Check if this is a profile/contact query that should be locally cached
    const isProfileQuery = filters.some(f => f.kinds?.includes(0));
    const isContactQuery = filters.some(f => f.kinds?.includes(3));
    const isCacheable = isProfileQuery || isContactQuery;

    // 1. Try local cache first for cacheable queries
    if (isCacheable) {
      const cachedResults = await eventCache.query(filters);
      if (cachedResults.length > 0) {
        debugLog(`[CachedNostr] Cache hit: ${cachedResults.length} events`);

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
        debugLog('[CachedNostr] Trying gateway for divine.video query');
        const gatewayResults: NostrEvent[] = [];
        for (const filter of filters) {
          const events = await queryGateway(filter, opts?.signal);
          gatewayResults.push(...events);
        }

        // Gateway can return empty for valid queries (e.g., no matching events)
        // Only fall back to WebSocket if gateway throws an error
        debugLog(`[CachedNostr] Gateway returned ${gatewayResults.length} events`);

        // Cache profile/contact results
        if (isCacheable && gatewayResults.length > 0) {
          await cacheResults(gatewayResults);
        }

        return gatewayResults;
      } catch (err) {
        debugLog('[CachedNostr] Gateway failed, falling back to WebSocket:', err);
      }
    }

    // 3. Fall back to WebSocket
    const results = await baseNostr.query(filters, opts);
    debugLog(`[CachedNostr] Relay returned ${results.length} events`);

    // Cache the results if cacheable
    if (isCacheable && results.length > 0) {
      await cacheResults(results);
    }

    return results;
  };
```

**Step 2: Test with browser**

Run: `npm run dev`

1. Open browser console
2. Navigate to Discovery page
3. Should see: `[CachedNostr] Trying gateway for divine.video query`
4. Should see: `[GatewayClient] Got X events`
5. Videos should load from gateway

**Step 3: Commit**

```bash
git add src/lib/cachedNostr.ts
git commit -m "feat: use gateway for all divine.video queries, not just profiles"
```

---

## Task 5: Add Logging for Performance Comparison

**Files:**
- Modify: `src/lib/cachedNostr.ts`

**Step 1: Add timing logs**

Update the query method to log timing:

```typescript
  cachedNostr.query = async (filters: NostrFilter[], opts?: { signal?: AbortSignal }): Promise<NostrEvent[]> => {
    const startTime = performance.now();
    debugLog('[CachedNostr] Query with filters:', filters);

    const relayUrl = getRelayUrl();
    const useGateway = shouldUseGateway(relayUrl);

    // ... rest of the method, but add timing to each path:

    // In the cache hit section:
    if (cachedResults.length > 0) {
      debugLog(`[CachedNostr] Cache hit: ${cachedResults.length} events in ${(performance.now() - startTime).toFixed(0)}ms`);
      // ...
    }

    // In the gateway section:
    if (useGateway) {
      try {
        const gatewayStart = performance.now();
        // ... gateway query ...
        debugLog(`[CachedNostr] Gateway returned ${gatewayResults.length} events in ${(performance.now() - gatewayStart).toFixed(0)}ms`);
        return gatewayResults;
      } catch (err) {
        debugLog(`[CachedNostr] Gateway failed after ${(performance.now() - startTime).toFixed(0)}ms, falling back to WebSocket:`, err);
      }
    }

    // In the WebSocket section:
    const wsStart = performance.now();
    const results = await baseNostr.query(filters, opts);
    debugLog(`[CachedNostr] WebSocket returned ${results.length} events in ${(performance.now() - wsStart).toFixed(0)}ms`);
```

**Step 2: Test and verify logs show timing**

Run: `npm run dev`

Check console for timing info like:
- `[CachedNostr] Gateway returned 20 events in 150ms`
- `[CachedNostr] WebSocket returned 20 events in 2500ms`

**Step 3: Commit**

```bash
git add src/lib/cachedNostr.ts
git commit -m "feat: add performance timing to cache/gateway/websocket queries"
```

---

## Task 6: Manual Integration Test

**No code changes - verification only**

**Step 1: Test gateway working**

1. Run `npm run dev`
2. Open http://localhost:8080
3. Open browser DevTools Console
4. Navigate to Discovery/Trending
5. Verify logs show gateway being used:
   - `[CachedNostr] Trying gateway for divine.video query`
   - `[GatewayClient] Querying: https://gateway.divine.video/query?filter=...`
   - `[GatewayClient] Got N events (cached: true/false)`

**Step 2: Test fallback when gateway fails**

1. In browser DevTools, go to Network tab
2. Right-click gateway request, select "Block request URL"
3. Refresh page
4. Verify logs show fallback:
   - `[CachedNostr] Gateway failed, falling back to WebSocket`
   - `[CachedNostr] WebSocket returned N events`

**Step 3: Test with non-divine relay**

1. Use relay picker to switch to another relay (e.g., relay.damus.io)
2. Verify gateway is NOT used:
   - Should NOT see `[CachedNostr] Trying gateway` logs
   - Should see direct WebSocket queries

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete gateway integration with cache-first, gateway-second, websocket-fallback"
```

---

## Summary

| Task | Files | Purpose |
|------|-------|---------|
| 1 | gatewayClient.ts, test | Gateway REST client |
| 2 | gatewayClient.test.ts | Query tests |
| 3 | cachedNostr.ts, NostrProvider.tsx | Wire gateway into query flow |
| 4 | cachedNostr.ts | Enable for all queries |
| 5 | cachedNostr.ts | Performance logging |
| 6 | (none) | Manual verification |

**Query flow after implementation:**
```
Local Cache (instant) → Gateway REST (fast) → WebSocket (fallback)
```
