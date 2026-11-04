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

describe('EventCache', () => {
  const originalIndexedDB = globalThis.indexedDB;

  afterEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: originalIndexedDB,
    });
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
