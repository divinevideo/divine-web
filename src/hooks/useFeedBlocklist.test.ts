// ABOUTME: Tests for useFeedBlocklist hook — per-viewer feed blocklist assembled from relay queries
// ABOUTME: Covers muters/blockers-of-viewer, own mutes/blocks, fail-open on relay errors, logged-out no-op

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useFeedBlocklist } from './useFeedBlocklist';

const VIEWER = 'v'.repeat(64);
const MUTER = 'a'.repeat(64);
const BLOCKER = 'b'.repeat(64);
const FRIEND_LISTER = 'c'.repeat(64);
const OWN_MUTED = 'd'.repeat(64);
const OWN_BLOCKED = 'e'.repeat(64);

const mockQuery = vi.fn();
let mockUser: { pubkey: string } | undefined;

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: { query: mockQuery } }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: mockUser }),
}));

let eventCounter = 0;
function makeEvent(overrides: Partial<NostrEvent>): NostrEvent {
  eventCounter++;
  return {
    id: String(eventCounter).padStart(64, '0'),
    pubkey: MUTER,
    created_at: 1700000000,
    kind: 10000,
    tags: [],
    content: '',
    sig: 'f'.repeat(128),
    ...overrides,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

/** Route mocked relay queries by filter shape, like a real relay would. */
function respondWith(events: NostrEvent[]) {
  mockQuery.mockImplementation(async (filters: NostrFilter[]) => {
    const results: NostrEvent[] = [];
    for (const filter of filters) {
      for (const event of events) {
        if (filter.kinds && !filter.kinds.includes(event.kind)) continue;
        if (filter.authors && !filter.authors.includes(event.pubkey)) continue;
        const pFilter = (filter as Record<string, unknown>)['#p'] as string[] | undefined;
        if (pFilter && !event.tags.some(t => t[0] === 'p' && pFilter.includes(t[1]))) continue;
        results.push(event);
      }
    }
    return results;
  });
}

describe('useFeedBlocklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { pubkey: VIEWER };
  });

  it('returns an empty set without querying when logged out', async () => {
    mockUser = undefined;
    const { result } = renderHook(() => useFeedBlocklist(), { wrapper: createWrapper() });
    expect(result.current.size).toBe(0);
    await waitFor(() => expect(mockQuery).not.toHaveBeenCalled());
  });

  it('includes authors who muted the viewer (kind 10000 p-tagging viewer)', async () => {
    respondWith([
      makeEvent({ pubkey: MUTER, kind: 10000, tags: [['p', VIEWER]] }),
    ]);
    const { result } = renderHook(() => useFeedBlocklist(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.has(MUTER)).toBe(true));
  });

  it('includes authors who blocked the viewer (kind 30000 d=block p-tagging viewer)', async () => {
    respondWith([
      makeEvent({ pubkey: BLOCKER, kind: 30000, tags: [['d', 'block'], ['p', VIEWER]] }),
    ]);
    const { result } = renderHook(() => useFeedBlocklist(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.has(BLOCKER)).toBe(true));
  });

  it('ignores kind 30000 lists with other d-tags (follow sets are not blocks)', async () => {
    respondWith([
      makeEvent({ pubkey: FRIEND_LISTER, kind: 30000, tags: [['d', 'friends'], ['p', VIEWER]] }),
    ]);
    const { result } = renderHook(() => useFeedBlocklist(), { wrapper: createWrapper() });
    // Wait for the query to settle, then confirm the follow-set author is not blocked
    await waitFor(() => expect(mockQuery).toHaveBeenCalled());
    await waitFor(() => expect(result.current.has(FRIEND_LISTER)).toBe(false));
    expect(result.current.size).toBe(0);
  });

  it("includes the viewer's own muted pubkeys (own kind 10000 p-tags)", async () => {
    respondWith([
      makeEvent({ pubkey: VIEWER, kind: 10000, tags: [['p', OWN_MUTED]] }),
    ]);
    const { result } = renderHook(() => useFeedBlocklist(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.has(OWN_MUTED)).toBe(true));
  });

  it("includes the viewer's own blocked pubkeys (own kind 30000 d=block p-tags)", async () => {
    respondWith([
      makeEvent({ pubkey: VIEWER, kind: 30000, tags: [['d', 'block'], ['p', OWN_BLOCKED]] }),
    ]);
    const { result } = renderHook(() => useFeedBlocklist(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.has(OWN_BLOCKED)).toBe(true));
  });

  it('unions all sources into one set', async () => {
    respondWith([
      makeEvent({ pubkey: MUTER, kind: 10000, tags: [['p', VIEWER]] }),
      makeEvent({ pubkey: BLOCKER, kind: 30000, tags: [['d', 'block'], ['p', VIEWER]] }),
      makeEvent({ pubkey: VIEWER, kind: 10000, tags: [['p', OWN_MUTED]] }),
      makeEvent({ pubkey: VIEWER, kind: 30000, tags: [['d', 'block'], ['p', OWN_BLOCKED]] }),
    ]);
    const { result } = renderHook(() => useFeedBlocklist(), { wrapper: createWrapper() });
    await waitFor(() =>
      expect(result.current).toEqual(new Set([MUTER, BLOCKER, OWN_MUTED, OWN_BLOCKED]))
    );
  });

  it('fails open: relay errors yield an empty set instead of blocking the feed', async () => {
    mockQuery.mockRejectedValue(new Error('relay timeout'));
    const { result } = renderHook(() => useFeedBlocklist(), { wrapper: createWrapper() });
    await waitFor(() => expect(mockQuery).toHaveBeenCalled());
    expect(result.current.size).toBe(0);
  });

  it('never includes the viewer themselves', async () => {
    respondWith([
      makeEvent({ pubkey: VIEWER, kind: 10000, tags: [['p', VIEWER]] }),
    ]);
    const { result } = renderHook(() => useFeedBlocklist(), { wrapper: createWrapper() });
    await waitFor(() => expect(mockQuery).toHaveBeenCalled());
    expect(result.current.has(VIEWER)).toBe(false);
  });
});
