import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSearchHashtags } from './useSearchHashtags';
import { fetchTrendingHashtags } from '@/lib/funnelcakeClient';

vi.mock('@/config/api', () => ({
  getFunnelcakeBaseUrl: () => 'https://api.divine.video',
}));

vi.mock('@/lib/funnelcakeClient', () => ({
  fetchTrendingHashtags: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useSearchHashtags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes hashtag searches to Funnelcake instead of filtering only popular tags', async () => {
    vi.mocked(fetchTrendingHashtags).mockResolvedValueOnce([
      { hashtag: 'twerking', video_count: 255 },
    ] as Awaited<ReturnType<typeof fetchTrendingHashtags>>);

    const { result } = renderHook(
      () => useSearchHashtags({ query: 'twerking', limit: 20 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchTrendingHashtags).toHaveBeenCalledWith(
      'https://api.divine.video',
      20,
      expect.any(AbortSignal),
      'twerking',
    );
    expect(result.current.data).toEqual([
      { hashtag: 'twerking', video_count: 255 },
    ]);
  });

  it('strips a leading hash before searching hashtags', async () => {
    vi.mocked(fetchTrendingHashtags).mockResolvedValueOnce([
      { hashtag: 'twerking', video_count: 255 },
    ] as Awaited<ReturnType<typeof fetchTrendingHashtags>>);

    const { result } = renderHook(
      () => useSearchHashtags({ query: '#Twerking', limit: 20 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchTrendingHashtags).toHaveBeenCalledWith(
      'https://api.divine.video',
      20,
      expect.any(AbortSignal),
      'twerking',
    );
  });
});
