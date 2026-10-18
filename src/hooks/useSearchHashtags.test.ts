import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSearchHashtags } from './useSearchHashtags';
import { fetchTrendingHashtags } from '@/lib/funnelcakeClient';
import { SYNTHETIC_NSEC } from '@/test/secretKeyFixture';

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
      {
        hashtag: 'twerking',
        video_count: 255,
        thumbnail: 'https://media.divine.video/twerking.jpg',
      },
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
      {
        hashtag: 'twerking',
        video_count: 255,
        thumbnail: 'https://media.divine.video/twerking.jpg',
      },
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

describe('useSearchHashtags with input that looks like a secret key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['a whole key', SYNTHETIC_NSEC],
    ['a hashtag-style key among other words', `tags #${SYNTHETIC_NSEC} here`],
  ])('skips the search for %s', async (_label, query) => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    try {
      const { result } = renderHook(
        () => useSearchHashtags({ query, limit: 20 }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      expect(fetchTrendingHashtags).not.toHaveBeenCalled();
      expect(JSON.stringify(infoSpy.mock.calls).toLowerCase()).not.toContain('nsec1');
      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();

      // A direct refetch skips the input as well
      await act(async () => {
        await result.current.refetch();
      });
      expect(fetchTrendingHashtags).not.toHaveBeenCalled();
      expect(JSON.stringify(infoSpy.mock.calls).toLowerCase()).not.toContain('nsec1');
    } finally {
      infoSpy.mockRestore();
    }
  });
});
