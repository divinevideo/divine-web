import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/funnelcakeClient', () => ({
  fetchUserVideos: vi.fn(),
}));

vi.mock('@/config/api', () => ({
  API_CONFIG: {
    funnelcake: {
      baseUrl: 'https://relay.divine.video',
    },
  },
}));

const TEST_PUBKEY = 'a'.repeat(64);

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

describe('useClassicVineArchiveStats', () => {
  let useClassicVineArchiveStats: typeof import('./useClassicVineArchiveStats').useClassicVineArchiveStats;
  let fetchUserVideos: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const client = await import('@/lib/funnelcakeClient');
    fetchUserVideos = client.fetchUserVideos as ReturnType<typeof vi.fn>;

    const hook = await import('./useClassicVineArchiveStats');
    useClassicVineArchiveStats = hook.useClassicVineArchiveStats;
  });

  it('aggregates original loops and classic vine count across paginated Funnelcake profile videos', async () => {
    fetchUserVideos
      .mockResolvedValueOnce({
        videos: [
          {
            id: 'video-1',
            pubkey: TEST_PUBKEY,
            created_at: 1700000000,
            kind: 34236,
            d_tag: 'a',
            video_url: 'https://example.com/a.mp4',
            platform: 'vine',
            loops: 12,
            tags: [['platform', 'vine'], ['loops', '100']],
          },
          {
            id: 'video-2',
            pubkey: TEST_PUBKEY,
            created_at: 1700000001,
            kind: 34236,
            d_tag: 'b',
            video_url: 'https://example.com/b.mp4',
            platform: 'vine',
            loops: 5,
            tags: [['platform', 'vine'], ['loops', '200']],
          },
        ],
        has_more: true,
        next_cursor: '2',
      })
      .mockResolvedValueOnce({
        videos: [
          {
            id: 'video-3',
            pubkey: TEST_PUBKEY,
            created_at: 1700000002,
            kind: 34236,
            d_tag: 'c',
            video_url: 'https://example.com/c.mp4',
            platform: 'vine',
            loops: 1,
            tags: [['platform', 'vine'], ['loops', '300']],
          },
          {
            id: 'video-4',
            pubkey: TEST_PUBKEY,
            created_at: 1700000003,
            kind: 34236,
            d_tag: 'd',
            video_url: 'https://example.com/d.mp4',
            platform: 'youtube',
            loops: 9,
          },
        ],
        has_more: false,
        next_cursor: undefined,
      });

    const { result } = renderHook(() => useClassicVineArchiveStats(TEST_PUBKEY), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        classicVineCount: 3,
        originalLoopCount: 600,
      });
    });
  });

  it('deduplicates duplicate archive rows before counting classic totals', async () => {
    fetchUserVideos.mockResolvedValueOnce({
      videos: [
        {
          id: 'video-1',
          pubkey: TEST_PUBKEY,
          created_at: 1700000000,
          kind: 34236,
          d_tag: 'dup-a',
          video_url: 'https://example.com/a.mp4',
          platform: 'vine',
          loops: 12,
          tags: [['platform', 'vine'], ['loops', '100']],
        },
        {
          id: 'video-2',
          pubkey: TEST_PUBKEY,
          created_at: 1700000001,
          kind: 34236,
          d_tag: 'dup-a',
          video_url: 'https://example.com/a-duplicate.mp4',
          platform: 'vine',
          loops: 12,
          tags: [['platform', 'vine'], ['loops', '100']],
        },
      ],
      has_more: false,
      next_cursor: undefined,
    });

    const { result } = renderHook(() => useClassicVineArchiveStats(TEST_PUBKEY), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        classicVineCount: 1,
        originalLoopCount: 100,
      });
    });
  });
});
