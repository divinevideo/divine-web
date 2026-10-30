// ABOUTME: Tests that useVideoProvider's fetchNextPage loads a page during a background refetch
// ABOUTME: and does not restart a next page that is already loading

import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useInfiniteQuery } from '@tanstack/react-query';
import { useVideoProvider } from './useVideoProvider';

const AUTHOR = 'a'.repeat(64);
const QUERY_KEY = ['video-provider-paging-test'];

const control = vi.hoisted(() => ({
  pageRequests: [] as number[],
  heldPage: null as number | null,
  release: null as null | (() => void),
}));

function makeVideo(id: string) {
  return {
    id,
    pubkey: AUTHOR,
    kind: 34236,
    createdAt: 1700000000,
    content: '',
    videoUrl: `https://cdn.example/${id}.mp4`,
    hashtags: [],
    vineId: id,
    reposts: [],
  };
}

vi.mock('@/hooks/useInfiniteVideosFunnelcake', () => ({
  useInfiniteVideosFunnelcake: (options: { enabled: boolean }) => useInfiniteQuery({
    queryKey: QUERY_KEY,
    enabled: options.enabled,
    initialPageParam: 0,
    getNextPageParam: (_lastPage: unknown, pages: unknown[]) => (pages.length < 5 ? pages.length : undefined),
    queryFn: async ({ pageParam, signal }: { pageParam: number; signal: AbortSignal }) => {
      control.pageRequests.push(pageParam);
      if (control.heldPage === pageParam) {
        await new Promise<void>((resolve, reject) => {
          control.release = resolve;
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }
      return { videos: [makeVideo(`page-${pageParam}`)], nextCursor: undefined };
    },
  }),
}));

vi.mock('@/hooks/useInfiniteVideos', () => ({
  useInfiniteVideos: () => ({
    data: undefined,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFeaturedTabVideos', () => ({
  useFeaturedTabVideos: () => ({
    data: undefined,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFeedBlocklist', () => ({
  useFeedBlocklist: () => new Set<string>(),
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({ config: { relayUrl: 'wss://relay.divine.video' } }),
}));

vi.mock('@/hooks/useRelayCapabilities', () => ({
  useResolvedRelayCapabilities: () => ({ supportsVideoSorts: true }),
}));

function renderProvider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useVideoProvider({ feedType: 'profile', pubkey: AUTHOR }), { wrapper });
  return { client, ...view };
}

describe('useVideoProvider fetchNextPage', () => {
  beforeEach(() => {
    control.pageRequests = [];
    control.heldPage = null;
    control.release = null;
  });

  // InfiniteScroll only re-arms next() when dataLength grows, so a call that
  // loads nothing leaves the feed stuck on its loader.
  it('loads the next page when called during a background refetch', async () => {
    const { client, result } = renderProvider();
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

    control.heldPage = 0;
    void client.refetchQueries({ queryKey: QUERY_KEY });
    await waitFor(() => expect(control.release).not.toBeNull());

    act(() => {
      void result.current.fetchNextPage();
    });
    control.heldPage = null;
    control.release?.();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(control.pageRequests).toContain(1);
  });

  it('does not restart a next page that is already loading', async () => {
    const { result } = renderProvider();
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

    control.heldPage = 1;
    act(() => {
      void result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true));
    act(() => {
      void result.current.fetchNextPage();
    });
    control.release?.();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(control.pageRequests.filter(page => page === 1)).toHaveLength(1);
  });
});
