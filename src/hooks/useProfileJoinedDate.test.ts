import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/funnelcakeClient', () => ({
  fetchUserVideos: vi.fn(),
  fetchVideoById: vi.fn(),
}));

vi.mock('@/lib/funnelcakeHealth', () => ({
  isFunnelcakeAvailable: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

vi.mock('@/config/api', () => ({
  API_CONFIG: {
    funnelcake: {
      baseUrl: 'https://api.divine.video',
    },
  },
}));

const mockNostrQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
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

describe('useProfileJoinedDate', () => {
  let useProfileJoinedDate: typeof import('./useProfileJoinedDate').useProfileJoinedDate;
  let fetchUserVideos: ReturnType<typeof vi.fn>;
  let fetchVideoById: ReturnType<typeof vi.fn>;
  let isFunnelcakeAvailable: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const client = await import('@/lib/funnelcakeClient');
    fetchUserVideos = client.fetchUserVideos as ReturnType<typeof vi.fn>;
    fetchVideoById = client.fetchVideoById as ReturnType<typeof vi.fn>;

    const health = await import('@/lib/funnelcakeHealth');
    isFunnelcakeAvailable = health.isFunnelcakeAvailable as ReturnType<typeof vi.fn>;

    const hook = await import('./useProfileJoinedDate');
    useProfileJoinedDate = hook.useProfileJoinedDate;

    isFunnelcakeAvailable.mockReturnValue(true);
    mockNostrQuery.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses the original Vine timestamp for classic profile videos', async () => {
    fetchUserVideos.mockResolvedValueOnce({
      videos: [{
        id: 'video-1',
        pubkey: TEST_PUBKEY,
        created_at: 1700000000,
        kind: 34236,
        d_tag: 'classic-1',
        video_url: 'https://example.com/video.mp4',
        classic: true,
        platform: 'vine',
      }],
      has_more: false,
    });

    fetchVideoById.mockResolvedValueOnce({
      id: 'video-1',
      pubkey: TEST_PUBKEY,
      created_at: 1700000000,
      kind: 34236,
      d_tag: 'classic-1',
      video_url: 'https://example.com/video.mp4',
      classic: true,
      platform: 'vine',
      tags: [['published_at', '1388534400']],
    });

    const { result } = renderHook(
      () => useProfileJoinedDate(TEST_PUBKEY, {
        totalVideoCount: 1,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.toISOString()).toBe('2014-01-01T00:00:00.000Z');
    expect(fetchUserVideos).toHaveBeenCalledWith(
      'https://api.divine.video',
      TEST_PUBKEY,
      expect.objectContaining({
        limit: 1,
        offset: 0,
        sort: 'recent',
        signal: expect.any(AbortSignal),
      })
    );
    expect(fetchVideoById).toHaveBeenCalledWith(
      'https://api.divine.video',
      'video-1',
      TEST_PUBKEY,
      expect.any(AbortSignal)
    );
  });

  it('uses the oldest profile video timestamp for non-classic profiles', async () => {
    fetchUserVideos.mockResolvedValueOnce({
      videos: [{
        id: 'video-2',
        pubkey: TEST_PUBKEY,
        created_at: 1622505600,
        kind: 34236,
        d_tag: 'recent-1',
        video_url: 'https://example.com/video.mp4',
      }],
      has_more: false,
    });

    const { result } = renderHook(
      () => useProfileJoinedDate(TEST_PUBKEY, {
        totalVideoCount: 5,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.toISOString()).toBe('2021-06-01T00:00:00.000Z');
    expect(fetchVideoById).not.toHaveBeenCalled();
  });

  it('falls back to Nostr events when the profile has no videos', async () => {
    mockNostrQuery.mockResolvedValueOnce([
      {
        id: 'meta-1',
        pubkey: TEST_PUBKEY,
        created_at: 1609459200,
        kind: 0,
        tags: [],
        content: '{}',
        sig: 'sig',
      },
      {
        id: 'contacts-1',
        pubkey: TEST_PUBKEY,
        created_at: 1640995200,
        kind: 3,
        tags: [],
        content: '',
        sig: 'sig',
      },
    ]);

    const { result } = renderHook(
      () => useProfileJoinedDate(TEST_PUBKEY, {
        totalVideoCount: 0,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.toISOString()).toBe('2021-01-01T00:00:00.000Z');
    expect(fetchUserVideos).not.toHaveBeenCalled();
  });

  it('uses exact Vine timestamps from already loaded videos without extra requests', async () => {
    const { result } = renderHook(
      () => useProfileJoinedDate(TEST_PUBKEY, {
        videos: [{
          id: 'video-3',
          pubkey: TEST_PUBKEY,
          kind: 34236,
          createdAt: 1700000000,
          originalVineTimestamp: 1388534400,
          content: '',
          videoUrl: 'https://example.com/video.mp4',
          hashtags: [],
          vineId: 'vine-3',
          isVineMigrated: true,
          reposts: [],
        }],
        totalVideoCount: 1,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.toISOString()).toBe('2014-01-01T00:00:00.000Z');
    expect(fetchUserVideos).not.toHaveBeenCalled();
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });
});
