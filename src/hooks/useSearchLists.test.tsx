// ABOUTME: Tests for useSearchLists — NIP-50 path + local-filter fallback

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockNostrQuery = vi.fn();

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

let useSearchLists: typeof import('./useSearchLists').useSearchLists;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  const mod = await import('./useSearchLists');
  useSearchLists = mod.useSearchLists;
});

const PEOPLE_LIST_EVENT = {
  id: 'aaaa',
  pubkey: 'a'.repeat(64),
  created_at: 1700000000,
  kind: 30000,
  tags: [
    ['d', 'my-list'],
    ['title', 'Dance Creators'],
    ['description', 'Best dancers'],
  ],
  content: '',
  sig: '0'.repeat(128),
};

const VIDEO_LIST_EVENT = {
  id: 'bbbb',
  pubkey: 'b'.repeat(64),
  created_at: 1700000001,
  kind: 30005,
  tags: [
    ['d', 'vines'],
    ['title', 'Classic Vines'],
    ['description', 'Vintage looping clips'],
  ],
  content: '',
  sig: '0'.repeat(128),
};

describe('useSearchLists', () => {
  it('NIP-50 path: returns parsed results when relay returns events', async () => {
    mockNostrQuery.mockResolvedValueOnce([PEOPLE_LIST_EVENT, VIDEO_LIST_EVENT]);

    const { result } = renderHook(
      () => useSearchLists({ query: 'dance', limit: 50 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });

    expect(mockNostrQuery).toHaveBeenCalledWith(
      [{ kinds: [30000, 30005], search: 'dance', limit: 50 }],
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toMatchObject({ kind: 30000, list: { name: 'Dance Creators' } });
    expect(result.current.data![1]).toMatchObject({ kind: 30005, list: { name: 'Classic Vines' } });
  });

  it('fallback path: fetches recent events and filters locally when NIP-50 returns nothing', async () => {
    // First call (NIP-50) returns nothing; second call (fallback) returns both events
    mockNostrQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([PEOPLE_LIST_EVENT, VIDEO_LIST_EVENT]);

    const { result } = renderHook(
      () => useSearchLists({ query: 'classic', limit: 50 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });

    // Second query should be the fallback (no search term)
    expect(mockNostrQuery).toHaveBeenCalledTimes(2);
    expect(mockNostrQuery).toHaveBeenNthCalledWith(
      2,
      [{ kinds: [30000, 30005], limit: 50 }],
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    // Only VIDEO_LIST_EVENT matches "classic" in its title
    const data = result.current.data!;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ kind: 30005, list: { name: 'Classic Vines' } });
  });
});
