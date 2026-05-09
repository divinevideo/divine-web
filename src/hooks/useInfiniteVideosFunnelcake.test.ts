import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockFetchVideos = vi.fn();
const mockFetchVideosV2 = vi.fn();
const mockFetchRecommendations = vi.fn();
const mockTransformToVideoPage = vi.fn();

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: 'a'.repeat(64) },
  }),
}));

vi.mock('@/lib/funnelcakeClient', () => ({
  fetchVideos: mockFetchVideos,
  fetchVideosV2: mockFetchVideosV2,
  searchVideos: vi.fn(),
  fetchUserVideos: vi.fn(),
  fetchUserFeed: vi.fn(),
  fetchRecommendations: mockFetchRecommendations,
}));

vi.mock('@/lib/funnelcakeTransform', () => ({
  transformToVideoPage: mockTransformToVideoPage,
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

vi.mock('@/lib/performanceMonitoring', () => ({
  performanceMonitor: {
    recordQuery: vi.fn(),
    recordFeedLoad: vi.fn(),
  },
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

let useInfiniteVideosFunnelcake: typeof import('./useInfiniteVideosFunnelcake').useInfiniteVideosFunnelcake;

beforeEach(async () => {
  vi.clearAllMocks();
  ({ useInfiniteVideosFunnelcake } = await import('./useInfiniteVideosFunnelcake'));
});

describe('useInfiniteVideosFunnelcake', () => {
  it('uses cursor-based pagination for recommendations', async () => {
    // Page 1: server returns cursor for next page
    mockFetchRecommendations
      .mockResolvedValueOnce({ videos: [{}], has_more: true, next_cursor: 'cursor-page2' });

    mockTransformToVideoPage
      .mockReturnValueOnce({
        videos: [
          { id: 'video-1', pubkey: 'p1', kind: 34236, createdAt: 101, vineId: 'd-1' },
          { id: 'video-2', pubkey: 'p2', kind: 34236, createdAt: 100, vineId: 'd-2' },
        ],
        nextCursor: undefined,
        rawCursor: 'cursor-page2',
        hasMore: true,
      });

    const { result } = renderHook(
      () => useInfiniteVideosFunnelcake({ feedType: 'recommendations', pageSize: 12 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // First page loaded — check the page data
    const page1 = result.current.data?.pages[0];
    expect(page1?.videos).toHaveLength(2);
    expect(page1?.recommendationsCursor).toBe('cursor-page2');
    expect(result.current.hasNextPage).toBe(true);
  });

  it('falls back to popular pagination when recommendations return no cursor', async () => {
    mockFetchRecommendations
      .mockResolvedValueOnce({ videos: [{}], has_more: false, next_cursor: null });

    mockFetchVideos
      .mockResolvedValueOnce({ videos: [{}], has_more: false, next_cursor: undefined });

    mockTransformToVideoPage
      .mockReturnValueOnce({
        videos: [
          { id: 'video-1', pubkey: 'p1', kind: 34236, createdAt: 101, vineId: 'd-1' },
        ],
        nextCursor: undefined,
        hasMore: false,
      })
      .mockReturnValueOnce({
        videos: [
          { id: 'video-2', pubkey: 'p2', kind: 34236, createdAt: 100, vineId: 'd-2' },
        ],
        nextCursor: undefined,
        offset: undefined,
        hasMore: false,
      });

    const { result } = renderHook(
      () => useInfiniteVideosFunnelcake({ feedType: 'recommendations', pageSize: 12 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Page should have no recCursor
    const page = result.current.data?.pages[0];
    expect(page?.recommendationsCursor).toBeUndefined();
    // Recommendations stop, but the feed should continue via popular fallback
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(2);
    });

    expect(mockFetchVideos).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        sort: 'popular',
        limit: 12,
        offset: 1,
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('falls back to popular pagination when recommendations return duplicate pages', async () => {
    // Server returns the same videos for both pages (offset/cursor ignored)
    const sameVideos = [
      { id: 'video-1', pubkey: 'p1', kind: 34236, createdAt: 101, vineId: 'd-1' },
      { id: 'video-2', pubkey: 'p2', kind: 34236, createdAt: 100, vineId: 'd-2' },
    ];
    const popularVideos = [
      { id: 'video-3', pubkey: 'p3', kind: 34236, createdAt: 99, vineId: 'd-3' },
      { id: 'video-4', pubkey: 'p4', kind: 34236, createdAt: 98, vineId: 'd-4' },
    ];

    mockFetchRecommendations
      .mockResolvedValueOnce({ videos: [{}], has_more: true, next_cursor: '12' })
      .mockResolvedValueOnce({ videos: [{}], has_more: true, next_cursor: '24' });

    mockFetchVideos
      .mockResolvedValueOnce({ videos: [{}], has_more: false, next_cursor: undefined });

    mockTransformToVideoPage
      .mockReturnValueOnce({ videos: sameVideos, nextCursor: undefined, rawCursor: '12', hasMore: true })
      .mockReturnValueOnce({ videos: sameVideos, nextCursor: undefined, rawCursor: '24', hasMore: true })
      .mockReturnValueOnce({ videos: popularVideos, nextCursor: undefined, offset: undefined, hasMore: false });

    const { result } = renderHook(
      () => useInfiniteVideosFunnelcake({ feedType: 'recommendations', pageSize: 12 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(mockFetchRecommendations).toHaveBeenCalledTimes(2);
    });

    expect(mockFetchRecommendations).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({
        cursor: '12',
        offset: 12,
        limit: 12,
      })
    );

    await waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(2);
    });

    expect(mockFetchVideos).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        sort: 'popular',
        limit: 12,
        offset: 2,
        signal: expect.any(AbortSignal),
      })
    );

    expect(result.current.data?.pages[1]?.videos).toEqual(popularVideos);
  });
});

describe('popular sort with period', () => {
  it('passes sort=popular and the chosen period to fetchVideosV2', async () => {
    mockFetchVideosV2.mockResolvedValueOnce({
      videos: [{}],
      has_more: false,
      next_cursor: undefined,
    });
    mockTransformToVideoPage.mockReturnValueOnce({
      videos: [{ id: 'v1', pubkey: 'p1', kind: 34236, createdAt: 1, vineId: 'd1' }],
      nextCursor: undefined,
      hasMore: false,
    });

    const { result } = renderHook(
      () => useInfiniteVideosFunnelcake({
        feedType: 'trending',
        sortMode: 'popular',
        period: 'week',
        pageSize: 12,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetchVideosV2).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        sort: 'popular',
        period: 'week',
        limit: 12,
      }),
    );
  });

  it('defaults popular sort to period=today when period is omitted', async () => {
    mockFetchVideosV2.mockResolvedValueOnce({ videos: [], has_more: false, next_cursor: undefined });
    mockTransformToVideoPage.mockReturnValueOnce({ videos: [], nextCursor: undefined, hasMore: false });

    renderHook(
      () => useInfiniteVideosFunnelcake({
        feedType: 'trending',
        sortMode: 'popular',
        pageSize: 12,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() =>
      expect(mockFetchVideosV2).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ sort: 'popular', period: 'today' }),
      ),
    );
  });

  it('does not consume edge-injected feed when period is set', async () => {
    // Simulate the real edge worker: it sets BOTH globals together.
    // See compute-js/src/index.js:207 — `window.__DIVINE_FEED_TYPE__="trending"`.
    // The fixture mimics what the Fastly edge worker injects, but the hook is
    // supposed to skip consumption when period is set — so the shape never
    // gets parsed. Use a structural type that bypasses FunnelcakeResponse's
    // required fields (id, pubkey, d_tag, video_url, etc.) to keep the test
    // narrow.
    type EdgeWindow = Window & { __DIVINE_FEED__?: unknown; __DIVINE_FEED_TYPE__?: string };
    (window as EdgeWindow).__DIVINE_FEED__ = {
      videos: [{ id: 'edge-video', pubkey: 'edge-p', kind: 34236, created_at: 1, d_tag: 'edge-d', video_url: 'https://example.com/edge.mp4' }],
      has_more: false,
    };
    (window as EdgeWindow).__DIVINE_FEED_TYPE__ = 'trending';

    mockFetchVideosV2.mockResolvedValueOnce({ videos: [{}], has_more: false, next_cursor: undefined });
    mockTransformToVideoPage.mockReturnValueOnce({
      videos: [{ id: 'api-video', pubkey: 'api-p', kind: 34236, createdAt: 2, vineId: 'api-d' }],
      nextCursor: undefined,
      hasMore: false,
    });

    const { result } = renderHook(
      () => useInfiniteVideosFunnelcake({ feedType: 'trending', sortMode: 'popular', period: 'today', pageSize: 12 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetchVideosV2).toHaveBeenCalled();
    expect(result.current.data?.pages[0]?.videos[0]?.id).toBe('api-video');

    expect((window as EdgeWindow).__DIVINE_FEED__).toBeDefined();
    expect((window as EdgeWindow).__DIVINE_FEED_TYPE__).toBe('trending');

    delete (window as EdgeWindow).__DIVINE_FEED__;
    delete (window as EdgeWindow).__DIVINE_FEED_TYPE__;
  });
});
