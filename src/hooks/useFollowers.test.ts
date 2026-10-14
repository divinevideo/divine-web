// ABOUTME: Tests for paginated follower-list fetching
// ABOUTME: Covers authoritative server search and query-echo validation

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/funnelcakeHealth', () => ({
  isFunnelcakeAvailable: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

import { getAllFollowerPubkeys, useFollowers } from './useFollowers';

const PUBKEY = 'a'.repeat(64);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useFollowers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('paginates the complete server-filtered result set', async () => {
    const matches = ['b'.repeat(64), 'c'.repeat(64)];
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return {
        ok: true,
        json: async () => ({
          followers: matches.slice(offset, offset + 1),
          total: matches.length,
          limit: 1,
          query: url.searchParams.get('q'),
        }),
      };
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useFollowers(PUBKEY, 'alice'), { wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));

    expect(getAllFollowerPubkeys(result.current.data)).toEqual(matches);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.every(([input]) =>
      String(input).includes('q=alice'))).toBe(true);
  });

  it('rejects an unfiltered response to a search request', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ followers: ['b'.repeat(64)], total: 1 }),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useFollowers(PUBKEY, 'alice'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(new Error('Follow-list search unavailable'));
  });
});
