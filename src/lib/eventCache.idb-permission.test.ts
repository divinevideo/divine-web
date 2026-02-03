import { describe, it, expect, vi, afterEach } from 'vitest';

describe('EventCache IDB/SW permission denied', () => {
  const originalIndexedDB = globalThis.indexedDB;

  afterEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: originalIndexedDB,
    });
  });

  it('does not throw when indexedDB is completely unavailable', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: undefined,
    });

    const { eventCache } = await import('./eventCache');

    expect(eventCache).toBeDefined();

    const results = await eventCache.query([{ kinds: [0], limit: 10 }]);
    expect(results).toEqual([]);
  });

  it('degrades to memory-only when IDB permission is denied', async () => {
    // Simulates Android browsers where user denied IDB permission
    // indexedDB exists but open() fires onerror
    const mockRequest = {
      result: null,
      error: new DOMException(
        'The user denied permission to access the database.',
        'UnknownError'
      ),
      onsuccess: null as ((ev: unknown) => void) | null,
      onerror: null as ((ev: unknown) => void) | null,
      onupgradeneeded: null as ((ev: unknown) => void) | null,
    };

    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: {
        open: () => {
          setTimeout(() => mockRequest.onerror?.({}), 0);
          return mockRequest;
        },
      },
    });

    const { eventCache } = await import('./eventCache');
    await new Promise(r => setTimeout(r, 10));

    const testEvent = {
      id: 'denied-event-1',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 0,
      tags: [],
      content: '{}',
      sig: 'test-sig',
    };

    // Should not throw — IDB init failure is handled gracefully
    await expect(eventCache.event(testEvent)).resolves.not.toThrow();

    // Memory cache should still work
    const results = await eventCache.query([
      { kinds: [0], authors: ['test-pubkey'], limit: 1 },
    ]);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('denied-event-1');
  });

  it('falls back to memory cache for all operations when IDB denied', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: undefined,
    });

    const { eventCache } = await import('./eventCache');

    const events = [
      {
        id: 'mem-1',
        pubkey: 'pk-1',
        created_at: Math.floor(Date.now() / 1000),
        kind: 0,
        tags: [],
        content: '{"name":"alice"}',
        sig: 'sig-1',
      },
      {
        id: 'mem-2',
        pubkey: 'pk-2',
        created_at: Math.floor(Date.now() / 1000) - 10,
        kind: 0,
        tags: [],
        content: '{"name":"bob"}',
        sig: 'sig-2',
      },
    ];

    // Store events — goes to memory only
    for (const event of events) {
      await eventCache.event(event);
    }

    // Query with limit <= stored count returns from memory cache
    const results = await eventCache.query([{ kinds: [0], limit: 2 }]);
    expect(results.length).toBe(2);

    // Remove should not throw
    await expect(eventCache.remove([{ kinds: [0] }])).resolves.not.toThrow();

    // Clear should not throw
    await expect(eventCache.clear()).resolves.not.toThrow();
  });
});
