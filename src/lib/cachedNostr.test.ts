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

const contactEvent: NostrEvent = {
  id: 'a'.repeat(64),
  pubkey: 'b'.repeat(64),
  created_at: 1000,
  kind: 3,
  tags: [['p', 'c'.repeat(64)]],
  content: '',
  sig: 'd'.repeat(128),
};

describe('createCachedNostr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
