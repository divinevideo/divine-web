import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

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

function contactEvent(id: string, createdAt: number, followCount: number): NostrEvent {
  return {
    id,
    pubkey: 'author',
    created_at: createdAt,
    kind: 3,
    tags: Array.from({ length: followCount }, (_, i) => ['p', `${i}`.padEnd(64, '0')]),
    content: '',
    sig: 'sig',
  };
}

const contactFilter = [{ kinds: [3], authors: ['author'], limit: 1 }];

describe('createCachedNostr — bypassCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serves kind-3 queries from the cache by default (cache-first)', async () => {
    const stale = contactEvent('stale', 1000, 5);
    const fresh = contactEvent('fresh', 2000, 4);
    mockEventCache.query.mockResolvedValue([stale]);
    const base = { query: vi.fn().mockResolvedValue([fresh]), event: vi.fn() };

    const nostr = createCachedNostr(base);
    const result = await nostr.query(contactFilter);

    // Default behaviour is unchanged: the cached (stale) list is returned and
    // the relay is only consulted by the non-awaited background refresh.
    expect(result).toEqual([stale]);
  });

  it('bypasses the cache and returns the authoritative relay event when bypassCache is set', async () => {
    const stale = contactEvent('stale', 1000, 5); // larger, but stale
    const fresh = contactEvent('fresh', 2000, 4); // newer + smaller: a removal
    mockEventCache.query.mockResolvedValue([stale]);
    const base = { query: vi.fn().mockResolvedValue([fresh]), event: vi.fn() };

    const nostr = createCachedNostr(base);
    const result = await nostr.query(contactFilter, { bypassCache: true });

    expect(result).toEqual([fresh]);
    expect(mockEventCache.query).not.toHaveBeenCalled();
    expect(base.query).toHaveBeenCalledTimes(1);
  });

  it('still writes the fresh relay result back to the cache when bypassing', async () => {
    const fresh = contactEvent('fresh', 2000, 4);
    mockEventCache.query.mockResolvedValue([contactEvent('stale', 1000, 5)]);
    const base = { query: vi.fn().mockResolvedValue([fresh]), event: vi.fn() };

    const nostr = createCachedNostr(base);
    await nostr.query(contactFilter, { bypassCache: true });

    expect(mockEventCache.event).toHaveBeenCalledWith(fresh);
  });
});
