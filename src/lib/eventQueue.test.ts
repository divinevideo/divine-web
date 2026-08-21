import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductAnalyticsV2Event } from '@/generated/productAnalytics';
import type { ProductEventQueueRecord } from './eventQueue';

function makeEvent(overrides: Partial<ProductAnalyticsV2Event> = {}): ProductAnalyticsV2Event {
  return {
    event_id: 'a'.repeat(64),
    event_name: 'landing_viewed',
    occurred_at: '2026-07-07T00:00:00.000Z',
    anonymous_id: '018ff7d7-0000-4000-8000-000000000002',
    session_id: '018ff7d7-0000-4000-8000-000000000003',
    source: 'web',
    platform: 'web',
    release: '0.0.0',
    consent_category: 'product_analytics',
    schema_version: 2,
    properties: {
      landing_page: 'home',
      referrer_class: 'direct',
    },
    ...overrides,
  } as ProductAnalyticsV2Event;
}

const baseEvent = makeEvent();

/**
 * An IndexedDB whose database opens but whose every request and transaction
 * fails, standing in for quota exhaustion or a corrupt store.
 */
function createFailingIndexedDB(): IDBFactory {
  const fail = <T extends { onerror?: ((event: Event) => void) | null }>(target: T): T => {
    queueMicrotask(() => target.onerror?.(new Event('error')));
    return target;
  };

  const store = {
    put: () => fail({ onsuccess: null, onerror: null, error: new DOMException('QuotaExceededError') }),
    delete: () => fail({ onsuccess: null, onerror: null, error: new DOMException('QuotaExceededError') }),
    clear: () => fail({ onsuccess: null, onerror: null, error: new DOMException('QuotaExceededError') }),
    getAll: () => fail({ onsuccess: null, onerror: null, error: new DOMException('QuotaExceededError') }),
  };

  const db = {
    objectStoreNames: { contains: () => false },
    createObjectStore: () => ({ createIndex: () => {} }),
    transaction: () => fail({
      objectStore: () => store,
      oncomplete: null,
      onerror: null,
      onabort: null,
      error: new DOMException('QuotaExceededError'),
    }),
  };

  return {
    open: () => {
      const request = { onsuccess: null, onerror: null, onupgradeneeded: null, result: db } as unknown as IDBOpenDBRequest & {
        onsuccess: ((event: Event) => void) | null;
      };
      queueMicrotask(() => request.onsuccess?.(new Event('success')));
      return request;
    },
  } as unknown as IDBFactory;
}

function createDeleteFailingIndexedDB(options: { failClear?: boolean; failPut?: boolean } = {}): IDBFactory {
  const records = new Map<string, ProductEventQueueRecord>();
  const makeRequest = <T>(result: T) => {
    const request = { onsuccess: null, onerror: null, result } as unknown as IDBRequest<T> & {
      onsuccess: ((event: Event) => void) | null;
      onerror: ((event: Event) => void) | null;
    };
    queueMicrotask(() => request.onsuccess?.(new Event('success')));
    return request;
  };

  const db = {
    objectStoreNames: { contains: () => false },
    createObjectStore: () => ({ createIndex: () => {} }),
    transaction: (_storeNames: string[], _mode: IDBTransactionMode) => {
      let deleteAttempted = false;
      let clearFailed = false;
      let putFailed = false;
      const transaction = {
        objectStore: () => ({
          put: (record: { id: string }) => {
            if (options.failPut) {
              putFailed = true;
            } else {
              records.set(record.id, record as ProductEventQueueRecord);
            }
            return makeRequest(record.id);
          },
          delete: (_id: string) => {
            deleteAttempted = true;
            return makeRequest(undefined);
          },
          clear: () => {
            if (options.failClear) {
              clearFailed = true;
            } else {
              records.clear();
            }
            return makeRequest(undefined);
          },
          getAll: () => makeRequest(Array.from(records.values())),
        }),
        oncomplete: null,
        onerror: null,
        onabort: null,
        error: new DOMException('QuotaExceededError'),
      } as unknown as IDBTransaction & {
        oncomplete: ((event: Event) => void) | null;
        onerror: ((event: Event) => void) | null;
      };

      queueMicrotask(() => {
        if (deleteAttempted || clearFailed || putFailed) {
          transaction.onerror?.(new Event('error'));
          return;
        }
        transaction.oncomplete?.(new Event('complete'));
      });

      return transaction;
    },
  };

  return {
    open: () => {
      const request = { onsuccess: null, onerror: null, onupgradeneeded: null, result: db } as unknown as IDBOpenDBRequest & {
        onsuccess: ((event: Event) => void) | null;
      };
      queueMicrotask(() => request.onsuccess?.(new Event('success')));
      return request;
    },
  } as unknown as IDBFactory;
}

describe('ProductEventQueue', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: undefined,
    });
  });

  it('keeps queued events flushable without blocking when IndexedDB is unavailable', async () => {
    const { ProductEventQueue } = await import('./eventQueue');
    const queue = new ProductEventQueue();

    await queue.enqueue(baseEvent);

    const pending = await queue.getFlushableBatch(10);
    expect(pending).toHaveLength(1);
    expect(pending[0].event).toEqual(baseEvent);
  });

  it('dead-letters an event after bounded failed attempts', async () => {
    const { ProductEventQueue, PRODUCT_EVENT_MAX_ATTEMPTS } = await import('./eventQueue');
    const queue = new ProductEventQueue({ baseRetryDelayMs: 0 });
    await queue.enqueue(baseEvent);

    for (let attempt = 0; attempt < PRODUCT_EVENT_MAX_ATTEMPTS; attempt += 1) {
      const [record] = await queue.getFlushableBatch(1);
      await queue.markFailed([record]);
    }

    expect(await queue.getFlushableBatch(10)).toHaveLength(0);
    expect(await queue.getDeadLetters()).toHaveLength(1);
  });

  it('caps the queue, dropping the oldest records first', async () => {
    const { ProductEventQueue, PRODUCT_EVENT_MAX_RECORDS } = await import('./eventQueue');
    const queue = new ProductEventQueue();

    for (let i = 0; i < PRODUCT_EVENT_MAX_RECORDS + 20; i += 1) {
      await queue.enqueue(makeEvent({ event_id: `event-${String(i).padStart(4, '0')}` }));
    }

    const records = await queue.getFlushableBatch(PRODUCT_EVENT_MAX_RECORDS + 50);
    expect(records).toHaveLength(PRODUCT_EVENT_MAX_RECORDS);
    // The 20 oldest are gone, the newest survive.
    expect(records.some((r) => r.id === 'event-0000')).toBe(false);
    expect(records.some((r) => r.id === `event-${String(PRODUCT_EVENT_MAX_RECORDS + 19).padStart(4, '0')}`)).toBe(true);
  });

  it('expires dead letters rather than keeping signed payloads forever', async () => {
    vi.useFakeTimers();
    try {
      const { ProductEventQueue, PRODUCT_EVENT_MAX_ATTEMPTS, PRODUCT_EVENT_MAX_AGE_MS } =
        await import('./eventQueue');
      const queue = new ProductEventQueue({ baseRetryDelayMs: 0 });
      await queue.enqueue(baseEvent);

      for (let attempt = 0; attempt < PRODUCT_EVENT_MAX_ATTEMPTS; attempt += 1) {
        const [record] = await queue.getFlushableBatch(1);
        await queue.markFailed([record]);
      }
      expect(await queue.getDeadLetters()).toHaveLength(1);

      vi.advanceTimersByTime(PRODUCT_EVENT_MAX_AGE_MS + 1);

      expect(await queue.getDeadLetters()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('expires pending records that were never delivered', async () => {
    vi.useFakeTimers();
    try {
      const { ProductEventQueue, PRODUCT_EVENT_MAX_AGE_MS } = await import('./eventQueue');
      const queue = new ProductEventQueue();
      await queue.enqueue(baseEvent);
      expect(await queue.getFlushableBatch(10)).toHaveLength(1);

      vi.advanceTimersByTime(PRODUCT_EVENT_MAX_AGE_MS + 1);

      expect(await queue.getFlushableBatch(10)).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes successfully flushed events', async () => {
    const { ProductEventQueue } = await import('./eventQueue');
    const queue = new ProductEventQueue();
    await queue.enqueue(baseEvent);

    const [record] = await queue.getFlushableBatch(1);
    await queue.markSucceeded([record.id]);

    expect(await queue.getFlushableBatch(10)).toHaveLength(0);
  });

  it('keeps anonymous and account-owned deliveries in separate batches', async () => {
    const { ProductEventQueue } = await import('./eventQueue');
    const queue = new ProductEventQueue();
    const signed = makeEvent({ event_id: 'b'.repeat(64) });
    const anonymous = makeEvent({ event_id: 'c'.repeat(64) });

    await queue.enqueue(signed, 'd'.repeat(64));
    await queue.enqueue(anonymous);

    expect(await queue.getSignedFlushableBatch(10, 'd'.repeat(64))).toMatchObject([
      { id: signed.event_id },
    ]);
    expect(await queue.getAnonymousFlushableBatch(10)).toMatchObject([
      { id: anonymous.event_id },
    ]);
  });

  it('purges only the account that logged out', async () => {
    const { ProductEventQueue } = await import('./eventQueue');
    const queue = new ProductEventQueue();
    await queue.enqueue(makeEvent({ event_id: 'b'.repeat(64) }), 'd'.repeat(64));
    await queue.enqueue(makeEvent({ event_id: 'c'.repeat(64) }), 'e'.repeat(64));
    await queue.enqueue(makeEvent({ event_id: 'f'.repeat(64) }));

    await queue.clearOwner('d'.repeat(64));

    expect(await queue.getSignedFlushableBatch(10, 'd'.repeat(64))).toHaveLength(0);
    expect(await queue.getSignedFlushableBatch(10, 'e'.repeat(64))).toHaveLength(1);
    expect(await queue.getAnonymousFlushableBatch(10)).toHaveLength(1);
  });

  it('does not resurrect a record deleted while its send was in flight', async () => {
    const { ProductEventQueue } = await import('./eventQueue');
    // Zero backoff so a resurrected record would be immediately flushable
    // rather than merely deferred by retry delay.
    const queue = new ProductEventQueue({ baseRetryDelayMs: 0 });
    const owner = 'd'.repeat(64);
    await queue.enqueue(makeEvent({ event_id: 'b'.repeat(64) }), owner);

    // Snapshot the batch as send() does, then clear it (account switch/logout)
    // while that send is still outstanding.
    const inFlight = await queue.getFlushableBatch(10, owner);
    expect(inFlight).toHaveLength(1);
    await queue.clearOwner(owner);
    expect(await queue.getFlushableBatch(10)).toHaveLength(0);

    // The outstanding send now fails; markFailed must not revive the cleared record.
    await queue.markFailed(inFlight);
    expect(await queue.getFlushableBatch(10)).toHaveLength(0);
  });

  describe('when IndexedDB rejects every operation', () => {
    beforeEach(() => {
      Object.defineProperty(globalThis, 'indexedDB', {
        writable: true,
        value: createFailingIndexedDB(),
      });
    });

    // Analytics is fire-and-forget: callers `void track()` and `void flush()`.
    // Storage pressure must degrade to the in-memory mirror, not surface as an
    // unhandled rejection in the app.
    it('enqueues without rejecting when the write transaction fails', async () => {
      const { ProductEventQueue } = await import('./eventQueue');
      const queue = new ProductEventQueue();

      await expect(queue.enqueue(baseEvent)).resolves.toBeUndefined();
      expect(await queue.getFlushableBatch(10)).toHaveLength(1);
    });

    it('marks records succeeded without rejecting when the delete fails', async () => {
      const { ProductEventQueue } = await import('./eventQueue');
      const queue = new ProductEventQueue();
      await queue.enqueue(baseEvent);

      await expect(queue.markSucceeded([baseEvent.event_id])).resolves.toBeUndefined();
      // The durable copy could not be removed, but the record must not be
      // re-sent from memory on the next flush.
      expect(await queue.getFlushableBatch(10)).toHaveLength(0);
    });

    it('clears without rejecting when the clear request fails', async () => {
      const { ProductEventQueue } = await import('./eventQueue');
      const queue = new ProductEventQueue();
      await queue.enqueue(baseEvent);

      await expect(queue.clear()).resolves.toBeUndefined();
      expect(await queue.getFlushableBatch(10)).toHaveLength(0);
    });
  });

  it('does not make a succeeded record flushable again when durable delete fails but later reads work', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: createDeleteFailingIndexedDB(),
    });
    const { ProductEventQueue } = await import('./eventQueue');
    const queue = new ProductEventQueue();
    await queue.enqueue(baseEvent);

    await queue.markSucceeded([baseEvent.event_id]);

    expect(await queue.getFlushableBatch(10)).toHaveLength(0);
  });

  it('keeps the memory copy flushable when a durable write fails but later reads work', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: createDeleteFailingIndexedDB({ failPut: true }),
    });
    const { ProductEventQueue } = await import('./eventQueue');
    const queue = new ProductEventQueue();

    await queue.enqueue(baseEvent);

    expect(await queue.getFlushableBatch(10)).toHaveLength(1);
  });

  it('does not make cleared records flushable again when durable clear fails but later reads work', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: createDeleteFailingIndexedDB({ failClear: true }),
    });
    const { ProductEventQueue } = await import('./eventQueue');
    const queue = new ProductEventQueue();
    await queue.enqueue(baseEvent);

    await queue.clear();

    expect(await queue.getFlushableBatch(10)).toHaveLength(0);
  });
});
