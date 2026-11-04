import { describe, it, expect, vi, afterEach } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

const owner = 'a'.repeat(64);
const staleList: NostrEvent = {
  id: 'b'.repeat(64), pubkey: owner, kind: 30005, created_at: 100,
  tags: [['d', 'saved-list']], content: '', sig: 'c'.repeat(128),
};
const deletion: NostrEvent = {
  ...staleList, id: 'd'.repeat(64), kind: 5, created_at: 200,
  tags: [['a', `30005:${owner}:saved-list`], ['k', '30005']],
};

type FakeRequest = {
  result: unknown;
  error: null;
  onsuccess: ((event: { target: FakeRequest }) => void) | null;
  onerror: null;
};

function fakeRequest(result: unknown): FakeRequest {
  const request: FakeRequest = { result, error: null, onsuccess: null, onerror: null };
  setTimeout(() => request.onsuccess?.({ target: request }));
  return request;
}

/** Just enough of IndexedDB for IndexedDBStore: put, and cursors over every row. */
function installWorkingIndexedDB() {
  const rows = new Map<string, { event: NostrEvent }>();
  const openCursor = () => {
    const values = [...rows.values()];
    const request: FakeRequest = { result: null, error: null, onsuccess: null, onerror: null };
    let position = 0;
    const advance = () => {
      request.result = position < values.length
        ? { value: values[position++], continue: () => setTimeout(advance) }
        : null;
      request.onsuccess?.({ target: request });
    };
    setTimeout(advance);
    return request;
  };
  const store = {
    put: (row: { event: NostrEvent }) => {
      rows.set(row.event.id, row);
      return fakeRequest(undefined);
    },
    index: () => ({ openCursor }),
    openCursor,
  };
  const db = { transaction: () => ({ objectStore: () => store }) };
  Object.defineProperty(globalThis, 'indexedDB', {
    writable: true,
    value: { open: () => fakeRequest(db) },
  });
  Object.defineProperty(globalThis, 'IDBKeyRange', {
    writable: true,
    configurable: true,
    value: { only: (value: unknown) => value },
  });
}

describe('EventCache', () => {
  const originalIndexedDB = globalThis.indexedDB;
  const originalKeyRange = Object.getOwnPropertyDescriptor(globalThis, 'IDBKeyRange');

  afterEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: originalIndexedDB,
    });
    if (originalKeyRange) Object.defineProperty(globalThis, 'IDBKeyRange', originalKeyRange);
    else delete (globalThis as { IDBKeyRange?: unknown }).IDBKeyRange;
  });

  it.each([undefined, 10])('retains memory deletion markers with a query limit of %s', async (limit) => {
    Object.defineProperty(globalThis, 'indexedDB', { writable: true, value: undefined });
    const { eventCache } = await import('./eventCache');
    await eventCache.event(deletion);

    expect(await eventCache.query([{ kinds: [5], authors: [owner], limit }])).toEqual([deletion]);
  });

  it('keeps a stale remote list hidden using a published deletion when IndexedDB is unavailable', async () => {
    Object.defineProperty(globalThis, 'indexedDB', { writable: true, value: undefined });
    const { createCachedNostr } = await import('./cachedNostr');
    const controller = new AbortController();
    const transport = {
      event: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockImplementation(async () => {
        controller.abort();
        return [staleList];
      }),
    };
    const nostr = createCachedNostr(transport);
    await nostr.event(deletion);

    expect(await nostr.query([{ kinds: [30005], authors: [owner] }], { signal: controller.signal }))
      .toEqual([]);
  });

  it('does not throw when indexedDB is unavailable', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: undefined,
    });

    const { eventCache } = await import('./eventCache');

    // Should not throw
    expect(eventCache).toBeDefined();

    // Query should return empty array, not throw
    const results = await eventCache.query([{ kinds: [0], limit: 10 }]);
    expect(results).toEqual([]);
  });

  it('falls back to memory cache when indexedDB unavailable', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: undefined,
    });

    const { eventCache } = await import('./eventCache');

    const testEvent = {
      id: 'test-event-id-123',
      pubkey: 'test-pubkey-abc',
      created_at: Math.floor(Date.now() / 1000),
      kind: 0,
      tags: [],
      content: '{"name":"test"}',
      sig: 'test-sig',
    };

    // event() should not throw — IndexedDB write is skipped, memory cache works
    await eventCache.event(testEvent);

    // Memory cache should have it
    const results = await eventCache.query([{ kinds: [0], authors: ['test-pubkey-abc'], limit: 1 }]);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('test-event-id-123');
  });

  it('does not serve a memory copy once its IndexedDB entry has expired', async () => {
    installWorkingIndexedDB();
    const { HybridEventCache, CACHE_TTL } = await import('./eventCache');
    const cache = new HybridEventCache();
    const profile: NostrEvent = { ...staleList, id: 'e'.repeat(64), kind: 0, tags: [], content: '{}' };
    const filters = [{ kinds: [0], authors: [owner] }];
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);

    try {
      await cache.event(profile);
      expect(await cache.query(filters)).toEqual([profile]);

      // The memory cache has no TTL; IndexedDB does. An expired profile must
      // read as a miss so cachedNostr fetches it from relays.
      clock.mockReturnValue(now + CACHE_TTL.PROFILE + 1);
      expect(await cache.query(filters)).toEqual([]);
    } finally {
      clock.mockRestore();
    }
  });

  it('remove and clear do not throw when indexedDB unavailable', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: undefined,
    });

    const { eventCache } = await import('./eventCache');

    await expect(eventCache.remove([{ kinds: [0] }])).resolves.not.toThrow();
    await expect(eventCache.clear()).resolves.not.toThrow();
  });
});
