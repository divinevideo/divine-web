import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockFetchUserVideos = vi.fn();
const mockSearchVideos = vi.fn();
const mockFetchVideoById = vi.fn();
const mockTransformFunnelcakeVideo = vi.fn((video: { id: string; pubkey: string; d_tag?: string }) => ({
  id: video.id,
  pubkey: video.pubkey,
  kind: 34236,
  createdAt: 1,
  content: '',
  videoUrl: 'https://example.com/video.mp4',
  hashtags: [],
  vineId: video.d_tag || video.id,
  reposts: [],
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: { relayUrl: 'wss://relay.divine.video' },
  }),
}));

vi.mock('@/config/relays', () => ({
  DEFAULT_FUNNELCAKE_URL: 'https://api.divine.video',
  getFunnelcakeUrl: () => 'https://api.divine.video',
}));

vi.mock('@/lib/funnelcakeClient', () => ({
  fetchUserVideos: mockFetchUserVideos,
  searchVideos: mockSearchVideos,
  fetchVideoById: mockFetchVideoById,
}));

vi.mock('@/lib/funnelcakeTransform', () => ({
  transformFunnelcakeVideo: mockTransformFunnelcakeVideo,
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
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

describe('useVideoByIdFunnelcake', () => {
  let useVideoByIdFunnelcake: typeof import('./useVideoByIdFunnelcake').useVideoByIdFunnelcake;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    ({ useVideoByIdFunnelcake } = await import('./useVideoByIdFunnelcake'));
  });

  it('falls back to a direct lookup when the narrowed context window misses the target video', async () => {
    mockFetchUserVideos.mockResolvedValueOnce({
      videos: [
        { id: 'neighbor-1', pubkey: 'p'.repeat(64), d_tag: 'neighbor-1' },
      ],
      has_more: true,
    });
    mockFetchVideoById.mockResolvedValueOnce({
      id: 'target-video',
      pubkey: 'p'.repeat(64),
      d_tag: 'target-video',
    });

    const { result } = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        pubkey: 'p'.repeat(64),
        currentIndex: 42,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.video?.id).toBe('target-video');
    });

    expect(mockFetchUserVideos).toHaveBeenCalledWith(
      'https://api.divine.video',
      'p'.repeat(64),
      expect.objectContaining({
        limit: 16,
        offset: 34,
        sort: 'recent',
        signal: expect.any(AbortSignal),
      })
    );
    expect(mockFetchVideoById).toHaveBeenCalledWith(
      'https://api.divine.video',
      'target-video',
      'p'.repeat(64),
      expect.any(AbortSignal)
    );
    expect(result.current.videos).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('skips the direct lookup when the context window already contains the target video', async () => {
    mockFetchUserVideos.mockResolvedValueOnce({
      videos: [
        { id: 'target-video', pubkey: 'p'.repeat(64), d_tag: 'target-video' },
      ],
      has_more: true,
    });

    const { result } = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        pubkey: 'p'.repeat(64),
        currentIndex: 3,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.video?.id).toBe('target-video');
    });

    expect(mockFetchUserVideos).toHaveBeenCalledTimes(1);
    expect(mockFetchVideoById).not.toHaveBeenCalled();
    expect(result.current.windowOffset).toBe(0);
  });
});
