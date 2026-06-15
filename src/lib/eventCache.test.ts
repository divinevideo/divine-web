import { describe, it, expect, vi, afterEach } from 'vitest';

describe('EventCache', () => {
  const originalIndexedDB = globalThis.indexedDB;

  afterEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: originalIndexedDB,
    });
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
