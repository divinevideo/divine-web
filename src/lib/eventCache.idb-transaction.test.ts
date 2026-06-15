import { describe, it, expect, vi, afterEach } from 'vitest';

describe('EventCache IDB transaction resilience', () => {
  const originalIndexedDB = globalThis.indexedDB;

  afterEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: originalIndexedDB,
    });
  });

  // Helper: creates a mock IDB that opens successfully but throws on transaction()
  // Simulates iOS Safari backgrounding where the IDB connection is closing
  function createClosingMockIDB() {
    const mockDB = {
      objectStoreNames: { contains: () => false },
      createObjectStore: () => ({
        createIndex: () => {},
      }),
      transaction: () => {
        throw new DOMException(
          "Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.",
          'InvalidStateError'
        );
      },
    };

    const mockRequest = {
      result: mockDB,
      error: null,
      onsuccess: null as ((ev: unknown) => void) | null,
      onerror: null as ((ev: unknown) => void) | null,
      onupgradeneeded: null as ((ev: unknown) => void) | null,
    };

    return {
      open: () => {
        setTimeout(() => mockRequest.onsuccess?.({}), 0);
        return mockRequest;
      },
    };
  }

  describe('db.transaction() throws InvalidStateError (connection closing)', () => {
    it('event() resolves silently', async () => {
      Object.defineProperty(globalThis, 'indexedDB', {
        writable: true,
        value: createClosingMockIDB(),
      });

      const { eventCache } = await import('./eventCache');
      await new Promise(r => setTimeout(r, 10));

      const testEvent = {
        id: 'test-closing-1',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 0,
        tags: [],
        content: '{}',
        sig: 'test-sig',
      };

      await expect(eventCache.event(testEvent)).resolves.not.toThrow();
    });

    it('query() returns memory-cache results instead of crashing', async () => {
      Object.defineProperty(globalThis, 'indexedDB', {
        writable: true,
        value: createClosingMockIDB(),
      });

      const { eventCache } = await import('./eventCache');
      await new Promise(r => setTimeout(r, 10));

      const results = await eventCache.query([{ kinds: [0], limit: 10 }]);
      expect(Array.isArray(results)).toBe(true);
    });

    it('remove() resolves silently', async () => {
      Object.defineProperty(globalThis, 'indexedDB', {
        writable: true,
        value: createClosingMockIDB(),
      });

      const { eventCache } = await import('./eventCache');
      await new Promise(r => setTimeout(r, 10));

      await expect(eventCache.remove([{ kinds: [0] }])).resolves.not.toThrow();
    });

    it('clear() resolves silently', async () => {
      Object.defineProperty(globalThis, 'indexedDB', {
        writable: true,
        value: createClosingMockIDB(),
      });

      const { eventCache } = await import('./eventCache');
      await new Promise(r => setTimeout(r, 10));

      await expect(eventCache.clear()).resolves.not.toThrow();
    });
  });

  describe('cursor.continue() throws TransactionInactiveError', () => {
    it('query returns partial results collected before cursor died', async () => {
      let callCount = 0;

      const mockCursor = {
        value: {
          event: {
            id: 'cursor-event-1',
            pubkey: 'test-pubkey',
            created_at: Math.floor(Date.now() / 1000),
            kind: 0,
            tags: [],
            content: '{}',
            sig: 'test-sig',
          },
          cached_at: Date.now(),
        },
        continue: () => {
          callCount++;
          if (callCount >= 1) {
            throw new DOMException(
              "Failed to execute 'continue' on 'IDBCursor': The transaction is inactive or finished.",
              'TransactionInactiveError'
            );
          }
        },
      };

      const mockStore = {
        openCursor: () => {
          const req = {
            result: mockCursor,
            onsuccess: null as ((ev: unknown) => void) | null,
            onerror: null as ((ev: unknown) => void) | null,
          };
          setTimeout(() => {
            req.onsuccess?.({ target: { result: mockCursor } });
          }, 0);
          return req;
        },
        index: () => ({
          openCursor: () => {
            const req = {
              result: mockCursor,
              onsuccess: null as ((ev: unknown) => void) | null,
              onerror: null as ((ev: unknown) => void) | null,
            };
            setTimeout(() => {
              req.onsuccess?.({ target: { result: mockCursor } });
            }, 0);
            return req;
          },
        }),
      };

      const mockDB = {
        objectStoreNames: { contains: () => false },
        createObjectStore: () => ({ createIndex: () => {} }),
        transaction: () => ({
          objectStore: () => mockStore,
        }),
      };

      const mockRequest = {
        result: mockDB,
        error: null,
        onsuccess: null as ((ev: unknown) => void) | null,
        onerror: null as ((ev: unknown) => void) | null,
        onupgradeneeded: null as ((ev: unknown) => void) | null,
      };

      Object.defineProperty(globalThis, 'indexedDB', {
        writable: true,
        value: {
          open: () => {
            setTimeout(() => mockRequest.onsuccess?.({}), 0);
            return mockRequest;
          },
        },
      });

      const { eventCache } = await import('./eventCache');
      await new Promise(r => setTimeout(r, 10));

      // Use a filter that triggers full table scan to avoid IDBKeyRange (unavailable in jsdom)
      const results = await eventCache.query([{ limit: 10 }]);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('cursor-event-1');
    });
  });
});
