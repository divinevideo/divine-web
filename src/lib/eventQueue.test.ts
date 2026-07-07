import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

const baseEvent: NostrEvent = {
  id: '018ff7d7000070008000000000000001',
  pubkey: 'a'.repeat(64),
  created_at: 1783382400,
  kind: 22237,
  tags: [
    ['client', 'divine-web'],
    ['schema', 'product_analytics_v1'],
    ['event_name', 'session_started'],
  ],
  content: JSON.stringify({
    event_name: 'session_started',
    occurred_at: '2026-07-07T00:00:00.000Z',
    anonymous_id: '018ff7d7-0000-7000-8000-000000000002',
    session_id: '018ff7d7-0000-7000-8000-000000000003',
    platform: 'web',
    app_version: '0.0.0',
    surface: 'home',
    schema_version: 1,
    properties: {},
  }),
  sig: 'b'.repeat(128),
};

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

  it('removes successfully flushed events', async () => {
    const { ProductEventQueue } = await import('./eventQueue');
    const queue = new ProductEventQueue();
    await queue.enqueue(baseEvent);

    const [record] = await queue.getFlushableBatch(1);
    await queue.markSucceeded([record.id]);

    expect(await queue.getFlushableBatch(10)).toHaveLength(0);
  });
});
