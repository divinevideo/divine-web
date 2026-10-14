import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchFeaturedTabVideos = vi.fn();
const mockTransformToVideoPage = vi.fn();

vi.mock('@/lib/featuredTabsClient', () => ({
  fetchFeaturedTabVideos: mockFetchFeaturedTabVideos,
}));

vi.mock('@/lib/funnelcakeTransform', () => ({
  transformToVideoPage: mockTransformToVideoPage,
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

let useFeaturedTabVideos: typeof import('./useFeaturedTabVideos').useFeaturedTabVideos;

beforeEach(async () => {
  vi.clearAllMocks();
  ({ useFeaturedTabVideos } = await import('./useFeaturedTabVideos'));
});

describe('useFeaturedTabVideos', () => {
  it('does not request videos without an eligible config id', () => {
    const { result } = renderHook(
      () => useFeaturedTabVideos({ configId: undefined, enabled: true }),
      { wrapper: createWrapper() }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchFeaturedTabVideos).not.toHaveBeenCalled();
  });

  it('fetches the configured tab and paginates with the opaque cursor', async () => {
    mockFetchFeaturedTabVideos
      .mockResolvedValueOnce({ videos: [{}], has_more: true, next_cursor: 'cursor-2' })
      .mockResolvedValueOnce({ videos: [{}], has_more: false, next_cursor: undefined });
    mockTransformToVideoPage
      .mockReturnValueOnce({
        videos: [{ id: 'video-1', pubkey: 'pubkey-1', kind: 34236, createdAt: 1, vineId: 'one' }],
        nextCursor: undefined,
        rawCursor: 'cursor-2',
        hasMore: true,
      })
      .mockReturnValueOnce({
        videos: [{ id: 'video-2', pubkey: 'pubkey-2', kind: 34236, createdAt: 2, vineId: 'two' }],
        nextCursor: undefined,
        rawCursor: undefined,
        hasMore: false,
      });

    const { result } = renderHook(
      () => useFeaturedTabVideos({ configId: 'ft_1234abcd', pageSize: 12 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(mockFetchFeaturedTabVideos).toHaveBeenNthCalledWith(
      1,
      'https://api.divine.video',
      'ft_1234abcd',
      undefined,
      12,
      expect.any(AbortSignal)
    );
    expect(mockFetchFeaturedTabVideos).toHaveBeenNthCalledWith(
      2,
      'https://api.divine.video',
      'ft_1234abcd',
      'cursor-2',
      12,
      expect.any(AbortSignal)
    );
  });
});
