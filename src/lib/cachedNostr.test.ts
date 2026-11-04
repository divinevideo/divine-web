import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { NPool, type NostrFilter, type NostrRelayEVENT, type NostrRelayEOSE } from '@nostrify/nostrify';
import { matchFilters } from 'nostr-tools';
import { buildEventRouter, buildReqRouter, type RoutingContext } from '@/lib/relayRouting';
import { getRelayUrls, PROFILE_RELAYS } from '@/config/relays';
import { publishListToPrimary } from '@/lib/publishListToPrimary';

const { mockEventCache } = vi.hoisted(() => ({
  mockEventCache: {
    query: vi.fn(),
    event: vi.fn(),
  },
}));

vi.mock('./eventCache', () => ({
  eventCache: mockEventCache,
}));

vi.mock('./debug', () => ({
  debugLog: vi.fn(),
}));

import { createCachedNostr } from './cachedNostr';

const contactEvent: NostrEvent = {
  id: 'a'.repeat(64),
  pubkey: 'b'.repeat(64),
  created_at: 1000,
  kind: 3,
  tags: [['p', 'c'.repeat(64)]],
  content: '',
  sig: 'd'.repeat(128),
};

const listEvent: NostrEvent = {
  ...contactEvent,
  id: '1'.repeat(64),
  kind: 30005,
  created_at: 100,
  tags: [['d', 'saved-list'], ['title', 'Saved list']],
};

function deletionEvent(tags: string[][], overrides: Partial<NostrEvent> = {}): NostrEvent {
  return { ...listEvent, id: '2'.repeat(64), kind: 5, created_at: 200, tags, ...overrides };
}

function listClient(deletions: NostrEvent[]) {
  const base = {
    query: vi.fn().mockResolvedValueOnce([listEvent]).mockResolvedValueOnce(deletions),
    event: vi.fn(),
  };
  return { base, nostr: createCachedNostr(base) };
}

function relayPool(
  context: RoutingContext,
  accepts: (url: string, event: NostrEvent) => boolean,
  stalled = new Set<string>(),
) {
  const stores = new Map<string, NostrEvent[]>();
  const pool = new NPool({
    reqRouter: buildReqRouter(context),
    eventRouter: buildEventRouter(context),
    open: (url) => {
      const events: NostrEvent[] = [];
      stores.set(url, events);
      const query = async (filters: NostrFilter[]) => events.filter(event => (
        matchFilters(filters, event) && !(event.kind === 30005 && events.some(event => event.kind === 5))
      ));
      return {
        query,
        event: async (event: NostrEvent) => {
          if (!accepts(url, event)) throw new Error('Relay rejected event');
          events.push(event);
        },
        async *req(filters: NostrFilter[], opts?: { signal?: AbortSignal }): AsyncIterable<NostrRelayEVENT | NostrRelayEOSE> {
          for (const event of await query(filters)) yield ['EVENT', 'test', event];
          if (stalled.has(url)) {
            await new Promise<void>(resolve => {
              if (opts?.signal?.aborted) resolve();
              else opts?.signal?.addEventListener('abort', () => resolve(), { once: true });
            });
            return;
          }
          yield ['EOSE', 'test'];
        },
        close: async () => {},
      };
    },
  });
  return { stores, nostr: createCachedNostr(pool) };
}

const routingContext: RoutingContext = {
  relayUrl: 'wss://relay.divine.video',
  relayUrls: ['wss://relay.divine.video'],
};

describe('createCachedNostr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventCache.query.mockResolvedValue([]);
    mockEventCache.event.mockResolvedValue(undefined);
  });

  it('does not add network-wide deletion discovery to a recent-list read', async () => {
    const { nostr, base } = listClient([]);
    const filters = [{ kinds: [30005], limit: 100 }];

    await nostr.query(filters);

    expect(base.query.mock.calls[0][0]).toEqual(filters);
  });

  it('keeps primary acknowledgement successful if the local event cache cannot write', async () => {
    const base = { query: vi.fn(), event: vi.fn().mockResolvedValue(undefined) };
    mockEventCache.event.mockRejectedValue(new Error('Storage unavailable'));

    await expect(createCachedNostr(base).event(listEvent)).resolves.toBeUndefined();
  });

  it('does not delay relay acknowledgement on a stalled local cache write', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    mockEventCache.event.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
    const base = { query: vi.fn(), event: vi.fn().mockResolvedValue(undefined) };
    let acknowledged = false;
    const pending = createCachedNostr(base).event(listEvent).then(() => { acknowledged = true; });
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(acknowledged).toBe(true);
    } finally {
      release();
      await pending;
      vi.useRealTimers();
    }
  });

  it('forwards directed event destinations and timeout signals to the underlying pool', async () => {
    const base = { query: vi.fn(), event: vi.fn().mockResolvedValue(undefined) };
    const opts = { relays: ['wss://relay.divine.video'], signal: new AbortController().signal };

    await createCachedNostr(base).event(listEvent, opts);

    expect(base.event).toHaveBeenCalledWith(listEvent, opts);
  });

  it.each(['none', 'primary', 'backup'])('preserves partial results with a stalled backup (deletion: %s)', async (source) => {
    vi.useFakeTimers();
    try {
      const backup = getRelayUrls(PROFILE_RELAYS).find(url => url !== routingContext.relayUrl)!;
      const deletionRelay = source === 'backup'
        ? getRelayUrls(PROFILE_RELAYS).find(url => url !== routingContext.relayUrl && url !== backup)!
        : routingContext.relayUrl;
      const { nostr, stores } = relayPool(routingContext, (url, event) => (
        event.kind !== 5 || url === deletionRelay
      ), new Set([backup]));
      await nostr.event(listEvent);
      if (source !== 'none') {
        stores.get(deletionRelay)!.push(deletionEvent([['a', `30005:${listEvent.pubkey}:saved-list`]]));
      }
      const controller = new AbortController();
      const query = nostr.query([{ kinds: [30005], authors: [listEvent.pubkey] }], { signal: controller.signal });
      const assertion = expect(query).resolves.toEqual(source === 'none' ? [listEvent] : []);
      setTimeout(() => controller.abort(), 5000);

      await vi.advanceTimersByTimeAsync(3000);
      await assertion;
      await nostr.close();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it('starts the remote deletion lookup without waiting for the local cache', async () => {
    const { base, nostr } = listClient([]);
    let releaseLocal!: (events: NostrEvent[]) => void;
    mockEventCache.query.mockReturnValue(new Promise<NostrEvent[]>(resolve => { releaseLocal = resolve; }));

    const query = nostr.query([{ kinds: [30005], authors: [listEvent.pubkey] }]);
    await vi.waitFor(() => expect(mockEventCache.query).toHaveBeenCalled());
    await vi.waitFor(() => expect(base.query).toHaveBeenCalledTimes(2));

    releaseLocal([]);
    await expect(query).resolves.toEqual([listEvent]);
  });

  it('preserves remote lists when the optional local deletion cache is unavailable', async () => {
    const { nostr } = listClient([]);
    mockEventCache.query.mockRejectedValue(new Error('Storage unavailable'));

    await expect(nostr.query([{ kinds: [30005] }])).resolves.toEqual([listEvent]);
  });

  it('reads a newly created list accepted only by a backup through the actual NPool', async () => {
    const backup = getRelayUrls(PROFILE_RELAYS).find(url => url !== routingContext.relayUrl)!;
    const { nostr } = relayPool(routingContext, url => url === backup);

    await nostr.event(listEvent);

    expect(await nostr.query([{ kinds: [30005], authors: [listEvent.pubkey] }])).toEqual([listEvent]);
    await nostr.close();
  });

  it.each([
    ['a', `30005:${listEvent.pubkey}:saved-list`],
    ['e', listEvent.id],
  ])('keeps a list deleted after NPool accepts its %s deletion only at the primary', async (tagName, target) => {
    const { nostr, stores } = relayPool(routingContext, (url, event) => (
      event.kind !== 5 || url === routingContext.relayUrl
    ));
    await nostr.event(listEvent);
    expect(await nostr.query([{ kinds: [30005] }])).toEqual([listEvent]);

    await nostr.event(deletionEvent([[tagName, target], ['k', '30005']]));

    expect([...stores.entries()].some(([url, events]) => (
      url !== routingContext.relayUrl && events.some(event => event.id === listEvent.id)
    ))).toBe(true);
    expect(await nostr.query([{ kinds: [30005] }])).toEqual([]);
    expect(await nostr.query([{ kinds: [30005] }])).toEqual([]);
    await nostr.close();
  });

  it('does not report a successful list save when only the disabled primary would accept it', async () => {
    const { nostr, stores } = relayPool({
      ...routingContext, disabledPresetUrls: [routingContext.relayUrl],
    }, url => url === routingContext.relayUrl);

    await expect(nostr.event(listEvent)).rejects.toThrow();
    expect(stores.has(routingContext.relayUrl)).toBe(false);
    await nostr.close();
  });

  it.each([
    ['a', `30005:${listEvent.pubkey}:saved-list`],
    ['e', listEvent.id],
  ])('hides a stale list targeted by an owner-authored %s deletion', async (tagName, target) => {
    const { nostr, base } = listClient([deletionEvent([[tagName, target]])]);

    expect(await nostr.query([{ kinds: [30005], authors: [listEvent.pubkey] }])).toEqual([]);
    expect(base.query).toHaveBeenLastCalledWith(expect.arrayContaining([
      expect.objectContaining({ kinds: [5], authors: [listEvent.pubkey], '#a': [`30005:${listEvent.pubkey}:saved-list`] }),
      expect.objectContaining({ kinds: [5], authors: [listEvent.pubkey], '#e': [listEvent.id] }),
    ]), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('rejects incomplete mutation reads instead of returning a partial owner snapshot', async () => {
    vi.useFakeTimers();
    try {
      const stalled = getRelayUrls(PROFILE_RELAYS).find(url => url !== routingContext.relayUrl)!;
      const { nostr } = relayPool(routingContext, () => true, new Set([stalled]));
      await nostr.event(listEvent);
      const opts = { signal: new AbortController().signal, requireComplete: true };
      const outcome = nostr.query([{ kinds: [30005], authors: [listEvent.pubkey] }], opts)
        .then(() => undefined, error => error);

      await vi.advanceTimersByTimeAsync(1500);

      expect(await outcome).toEqual(expect.objectContaining({ name: 'AbortError' }));
      await nostr.close();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it('requires actual NPool primary acknowledgement despite healthy backup relays', async () => {
    vi.useFakeTimers();
    try {
      const { nostr } = relayPool(routingContext, url => url !== routingContext.relayUrl);
      const outcome = publishListToPrimary(nostr, listEvent).then(() => undefined, error => error);

      await vi.advanceTimersByTimeAsync(3000);

      expect(await outcome).toEqual(expect.objectContaining({ name: 'AggregateError' }));
      expect(mockEventCache.event).not.toHaveBeenCalled();
      await nostr.close();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it('does not allow a different author to delete a list', async () => {
    const { nostr } = listClient([deletionEvent([
      ['a', `30005:${listEvent.pubkey}:saved-list`], ['e', listEvent.id],
    ], { pubkey: 'f'.repeat(64) })]);

    expect(await nostr.query([{ kinds: [30005] }])).toEqual([listEvent]);
  });

  it('keeps a list recreated after its address was deleted', async () => {
    const { nostr } = listClient([deletionEvent([
      ['a', `30005:${listEvent.pubkey}:saved-list`],
    ], { created_at: 99 })]);

    expect(await nostr.query([{ kinds: [30005] }])).toEqual([listEvent]);
  });

  it('uses known local deletions when the remote deletion lookup returns partial results', async () => {
    const controller = new AbortController();
    const { nostr, base } = listClient([]);
    base.query.mockReset()
      .mockResolvedValueOnce([listEvent])
      .mockImplementationOnce(async () => {
        controller.abort();
        return [];
      });
    mockEventCache.query.mockResolvedValue([deletionEvent([
      ['a', `30005:${listEvent.pubkey}:saved-list`],
    ])]);

    await expect(nostr.query([{ kinds: [30005] }], { signal: controller.signal })).resolves.toEqual([]);
  });

  it('leaves req uncached for authoritative relay reads', async () => {
    const base = {
      query: vi.fn(),
      event: vi.fn(),
      async *req() {
        yield ['EVENT', 'subscription', contactEvent] as const;
        yield ['EOSE', 'subscription'] as const;
      },
    };
    const nostr = createCachedNostr(base);
    const messages: Array<readonly unknown[]> = [];

    for await (const message of nostr.req()) {
      messages.push(message);
    }

    expect(messages).toEqual([
      ['EVENT', 'subscription', contactEvent],
      ['EOSE', 'subscription'],
    ]);
    expect(mockEventCache.query).not.toHaveBeenCalled();
  });
});
