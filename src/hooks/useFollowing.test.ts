// ABOUTME: Tests for the following-list hook
// ABOUTME: Covers response-shape handling and pagination past the server page cap

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

import { getAllFollowingPubkeys, useFollowing } from './useFollowing';

const PUBKEY = 'a'.repeat(64);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

function pubkeyAt(index: number): string {
  return index.toString(16).padStart(64, '0');
}

/** Mirrors the server: `limit` is clamped to its cap and `offset` slices the list. */
function mockPagedFollowing(total: number, serverCap = 100) {
  const all = Array.from({ length: total }, (_, index) => pubkeyAt(index));

  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), serverCap);

    return {
      ok: true,
      json: async () => ({
        following: all.slice(offset, offset + limit),
        limit,
        offset,
        total,
      }),
    };
  }) as unknown as typeof fetch;

  return all;
}

describe('useFollowing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the whole list when it fits in one page', async () => {
    const all = mockPagedFollowing(61);

    const { result } = renderHook(() => useFollowing(PUBKEY), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAllFollowingPubkeys(result.current.data)).toEqual(all);
    expect(result.current.data?.pages[0].total).toBe(61);
  });

  it('pages past the server cap instead of silently truncating', async () => {
    // The endpoint clamps `limit` to 100 and reports the real size in `total`.
    // Reading one page leaves the caller with 100 of 250 and no signal that
    // anything is missing, so the follow-list dialog just loses people.
    const all = mockPagedFollowing(250);

    const { result } = renderHook(() => useFollowing(PUBKEY), { wrapper });

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await result.current.fetchNextPage();
    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(getAllFollowingPubkeys(result.current.data)).toEqual(all);
  });

  it('uses the effective server limit when deciding whether a page is short', async () => {
    const all = mockPagedFollowing(90, 40);

    const { result } = renderHook(() => useFollowing(PUBKEY), { wrapper });

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await result.current.fetchNextPage();
    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(getAllFollowingPubkeys(result.current.data)).toEqual(all);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('stops when a page comes back short even if total disagrees', async () => {
    // A total that overstates the list must not spin forever.
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        following: [pubkeyAt(0)],
        limit: 100,
        offset: 0,
        total: 9999,
      }),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useFollowing(PUBKEY), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAllFollowingPubkeys(result.current.data)).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('searches on the server and accepts only an echoed query', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      return {
        ok: true,
        json: async () => ({
          following: [pubkeyAt(1)],
          total: 1,
          limit: 100,
          query: url.searchParams.get('q'),
        }),
      };
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useFollowing(PUBKEY, 'alice'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(String((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]))
      .toContain('q=alice');
    expect(getAllFollowingPubkeys(result.current.data)).toEqual([pubkeyAt(1)]);
  });

  it('rejects an unfiltered response to a search request', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ following: [pubkeyAt(1)], total: 1, limit: 100 }),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useFollowing(PUBKEY, 'alice'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error('Follow-list search unavailable'));
  });
});
