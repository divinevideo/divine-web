// ABOUTME: Tests for public people-list relay queries

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNostrQuery = vi.fn();

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: { query: mockNostrQuery } }),
}));

const OWNER = 'a'.repeat(64);
const MEMBER = 'b'.repeat(64);

function peopleListEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'c'.repeat(64),
    pubkey: OWNER,
    kind: 30000,
    created_at: 100,
    tags: [['d', 'friends'], ['title', 'Friends'], ['p', MEMBER]],
    content: '',
    sig: 'd'.repeat(128),
    ...overrides,
  };
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe('people list hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNostrQuery.mockResolvedValue([]);
  });

  it('queries and deduplicates a profile’s public kind 30000 lists', async () => {
    mockNostrQuery.mockResolvedValue([
      peopleListEvent({ created_at: 10, tags: [['d', 'friends'], ['title', 'Old']] }),
      peopleListEvent({ created_at: 20, tags: [['d', 'friends'], ['title', 'New']] }),
      peopleListEvent({ created_at: 30, tags: [['d', 'block'], ['title', 'Blocked'], ['p', MEMBER]] }),
      peopleListEvent({ created_at: 40, tags: [['d', 'mute'], ['title', 'Muted'], ['p', MEMBER]] }),
    ]);
    const { usePeopleLists } = await import('./usePeopleLists');

    const { result } = renderHook(() => usePeopleLists(OWNER), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockNostrQuery).toHaveBeenCalledWith(
      [{ kinds: [30000], authors: [OWNER], limit: 100 }],
      { signal: expect.any(AbortSignal) },
    );
    expect(result.current.data?.map((list) => list.name)).toEqual(['New']);
  });

  it('does not query without an owner pubkey', async () => {
    const { usePeopleLists } = await import('./usePeopleLists');
    const { result } = renderHook(() => usePeopleLists(undefined), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });

  it('queries an exact owner-aware people list and keeps the newest version', async () => {
    mockNostrQuery.mockResolvedValue([
      peopleListEvent({ created_at: 10, tags: [['d', 'friends'], ['title', 'Old']] }),
      peopleListEvent({ created_at: 20, tags: [['d', 'friends'], ['title', 'New']] }),
    ]);
    const { usePeopleList } = await import('./usePeopleLists');

    const { result } = renderHook(() => usePeopleList(OWNER, 'friends'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockNostrQuery).toHaveBeenCalledWith(
      [{ kinds: [30000], authors: [OWNER], '#d': ['friends'], limit: 10 }],
      { signal: expect.any(AbortSignal) },
    );
    expect(result.current.data?.name).toBe('New');
  });
});
