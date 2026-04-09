import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockFetchRecommendations = vi.fn();
const mockTransformToVideoPage = vi.fn();

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: 'a'.repeat(64) },
  }),
}));

vi.mock('@/lib/funnelcakeClient', () => ({
  fetchVideos: vi.fn(),
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
  it('stops paginating recommendations when a new page contains no new videos', async () => {
    mockFetchRecommendations
      .mockResolvedValueOnce({ videos: [{}], has_more: true, next_cursor: '12' })
      .mockResolvedValueOnce({ videos: [{}], has_more: true, next_cursor: '24' });

    mockTransformToVideoPage
      .mockReturnValueOnce({
        videos: [
          { id: 'video-1', pubkey: 'p1', kind: 34236, createdAt: 101, vineId: 'd-1' },
          { id: 'video-2', pubkey: 'p2', kind: 34236, createdAt: 100, vineId: 'd-2' },
        ],
        nextCursor: undefined,
        offset: 12,
        hasMore: true,
      })
      .mockReturnValueOnce({
        videos: [
          { id: 'video-1', pubkey: 'p1', kind: 34236, createdAt: 101, vineId: 'd-1' },
          { id: 'video-2', pubkey: 'p2', kind: 34236, createdAt: 100, vineId: 'd-2' },
        ],
        nextCursor: undefined,
        offset: 24,
        hasMore: true,
      });

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
      expect(result.current.data?.pages).toHaveLength(2);
    });

    expect(result.current.hasNextPage).toBe(false);
    expect(mockFetchRecommendations).toHaveBeenNthCalledWith(
      2,
      'https://api.divine.video',
      expect.objectContaining({
        offset: 12,
        limit: 12,
      })
    );
  });
});
