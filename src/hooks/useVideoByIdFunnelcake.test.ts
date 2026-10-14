import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockFetchUserVideos = vi.fn();
const mockSearchVideos = vi.fn();
const mockFetchVideoById = vi.fn();
const mockFetchFeaturedTabVideos = vi.fn();
const mockBlocklist = new Set<string>();
const mockTransformToVideoPage = vi.fn((response: {
  videos: Array<{ id: string; pubkey: string; d_tag?: string }>;
  has_more?: boolean;
  next_cursor?: string;
}) => ({
  videos: response.videos.map((video) => ({
    id: video.id,
    pubkey: video.pubkey,
    kind: 34236,
    createdAt: 1,
    content: '',
    videoUrl: 'https://example.com/video.mp4',
    hashtags: [],
    vineId: video.d_tag || video.id,
    reposts: [],
  })),
  nextCursor: undefined,
  offset: response.next_cursor ? parseInt(response.next_cursor, 10) : undefined,
  rawCursor: response.next_cursor,
  hasMore: Boolean(response.has_more),
}));
const mockUseFeaturedTab = vi.fn();
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

vi.mock('@/lib/featuredTabsClient', () => ({
  fetchFeaturedTabVideos: mockFetchFeaturedTabVideos,
}));

vi.mock('@/lib/funnelcakeTransform', () => ({
  transformFunnelcakeVideo: mockTransformFunnelcakeVideo,
  transformToVideoPage: mockTransformToVideoPage,
}));

vi.mock('@/hooks/useFeaturedTab', () => ({
  useFeaturedTab: mockUseFeaturedTab,
}));

vi.mock('@/hooks/useFeedBlocklist', () => ({
  useFeedBlocklist: () => mockBlocklist,
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
    mockBlocklist.clear();
    mockUseFeaturedTab.mockReturnValue({
      tab: null,
      isResolved: true,
    });

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

  it('starts the direct lookup immediately while profile context is still loading', async () => {
    let resolveUserVideos: (response: { videos: Array<{ id: string; pubkey: string; d_tag?: string }> }) => void;
    mockFetchUserVideos.mockImplementationOnce(() => new Promise(resolve => {
      resolveUserVideos = resolve;
    }));
    mockFetchVideoById.mockResolvedValueOnce({
      id: 'target-video',
      pubkey: 'p'.repeat(64),
      d_tag: 'target-video',
    });

    const { result } = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        pubkey: 'p'.repeat(64),
        currentIndex: 0,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(mockFetchVideoById).toHaveBeenCalledWith(
        'https://api.divine.video',
        'target-video',
        'p'.repeat(64),
        expect.any(AbortSignal)
      );
    });

    await waitFor(() => {
      expect(result.current.video?.id).toBe('target-video');
    });

    resolveUserVideos!({ videos: [] });
  });

  it('uses context video for navigation when the context window already contains the target video', async () => {
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
    expect(result.current.videos?.map(video => video.id)).toEqual(['target-video']);
    expect(result.current.windowOffset).toBe(0);
  });

  it('uses search results for navigation when search context is provided', async () => {
    mockSearchVideos.mockResolvedValueOnce({
      videos: [
        { id: 'neighbor-1', pubkey: 'p'.repeat(64), d_tag: 'neighbor-1' },
        { id: 'target-video', pubkey: 'p'.repeat(64), d_tag: 'target-video' },
      ],
      has_more: true,
    });

    const { result } = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        query: 'twerking',
        sortMode: 'top',
        currentIndex: 9,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.video?.id).toBe('target-video');
    });

    expect(mockSearchVideos).toHaveBeenCalledWith(
      'https://api.divine.video',
      expect.objectContaining({
        query: 'twerking',
        sort: 'loops',
        limit: 16,
        offset: 1,
        signal: expect.any(AbortSignal),
      })
    );
    expect(mockFetchVideoById).toHaveBeenCalledWith(
      'https://api.divine.video',
      'target-video',
      undefined,
      expect.any(AbortSignal)
    );
    expect(result.current.videos?.map(video => video.id)).toEqual(['neighbor-1', 'target-video']);
  });

  it('fetches additional profile pages from the initial window offset', async () => {
    mockFetchUserVideos
      .mockResolvedValueOnce({
        videos: [
          { id: 'target-video', pubkey: 'p'.repeat(64), d_tag: 'target-video' },
          { id: 'neighbor-1', pubkey: 'p'.repeat(64), d_tag: 'neighbor-1' },
        ],
        has_more: true,
        next_cursor: '52',
      })
      .mockResolvedValueOnce({
        videos: [
          { id: 'neighbor-2', pubkey: 'p'.repeat(64), d_tag: 'neighbor-2' },
        ],
        has_more: false,
      });

    const { result } = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        pubkey: 'p'.repeat(64),
        currentIndex: 44,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });

    await result.current.fetchNextPage();

    await waitFor(() => {
      expect(result.current.videos?.map(video => video.id)).toEqual([
        'target-video',
        'neighbor-1',
        'neighbor-2',
      ]);
    });

    expect(mockFetchUserVideos).toHaveBeenNthCalledWith(
      1,
      'https://api.divine.video',
      'p'.repeat(64),
      expect.objectContaining({
        offset: 36,
      })
    );
    expect(mockFetchUserVideos).toHaveBeenNthCalledWith(
      2,
      'https://api.divine.video',
      'p'.repeat(64),
      expect.objectContaining({
        offset: 52,
      })
    );
    expect(result.current.fetchedCount).toBe(3);
  });

  it('deduplicates videos that repeat across paginated pages', async () => {
    // A publish/delete between page fetches can shift a row across the offset
    // boundary, so the same addressable video can appear on two pages.
    mockFetchUserVideos
      .mockResolvedValueOnce({
        videos: [
          { id: 'target-video', pubkey: 'p'.repeat(64), d_tag: 'target-video' },
          { id: 'neighbor-1', pubkey: 'p'.repeat(64), d_tag: 'neighbor-1' },
        ],
        has_more: true,
        next_cursor: '52',
      })
      .mockResolvedValueOnce({
        videos: [
          { id: 'neighbor-1', pubkey: 'p'.repeat(64), d_tag: 'neighbor-1' },
          { id: 'neighbor-2', pubkey: 'p'.repeat(64), d_tag: 'neighbor-2' },
        ],
        has_more: false,
      });

    const { result } = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        pubkey: 'p'.repeat(64),
        currentIndex: 44,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });

    await result.current.fetchNextPage();

    await waitFor(() => {
      expect(result.current.videos?.map(video => video.id)).toEqual([
        'target-video',
        'neighbor-1',
        'neighbor-2',
      ]);
    });
  });

  it('exposes pagination for hashtag and search navigation contexts', async () => {
    mockSearchVideos
      .mockResolvedValueOnce({
        videos: [
          { id: 'target-video', pubkey: 'p'.repeat(64), d_tag: 'target-video' },
        ],
        has_more: true,
        next_cursor: '16',
      })
      .mockResolvedValueOnce({
        videos: [
          { id: 'search-next', pubkey: 'p'.repeat(64), d_tag: 'search-next' },
        ],
        has_more: false,
      });

    const searchResult = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        query: 'twerking',
        currentIndex: 8,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(searchResult.result.current.hasNextPage).toBe(true);
    });

    await searchResult.result.current.fetchNextPage();

    await waitFor(() => {
      expect(searchResult.result.current.videos?.map(video => video.id)).toEqual([
        'target-video',
        'search-next',
      ]);
    });

    expect(mockSearchVideos).toHaveBeenNthCalledWith(
      2,
      'https://api.divine.video',
      expect.objectContaining({
        query: 'twerking',
        offset: 16,
      })
    );

    mockSearchVideos.mockReset();
    mockFetchVideoById.mockReset();
    mockSearchVideos.mockResolvedValueOnce({
      videos: [
        { id: 'target-video', pubkey: 'p'.repeat(64), d_tag: 'target-video' },
      ],
      has_more: true,
      next_cursor: '24',
    });

    const hashtagResult = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        hashtag: 'cats',
        currentIndex: 12,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(hashtagResult.result.current.hasNextPage).toBe(true);
    });

    expect(mockSearchVideos).toHaveBeenCalledWith(
      'https://api.divine.video',
      expect.objectContaining({
        tag: 'cats',
        offset: 4,
      })
    );
  });

  it('uses eligible featured tab videos for navigation in server order', async () => {
    mockUseFeaturedTab.mockReturnValue({
      tab: { id: 'ft_1234abcd' },
      isResolved: true,
    });
    mockFetchFeaturedTabVideos.mockResolvedValueOnce({
      videos: [
        { id: 'featured-1', pubkey: 'p'.repeat(64), d_tag: 'featured-1' },
        { id: 'target-video', pubkey: 'p'.repeat(64), d_tag: 'target-video' },
        { id: 'featured-3', pubkey: 'p'.repeat(64), d_tag: 'featured-3' },
      ],
      has_more: true,
      next_cursor: 'cursor-2',
    });

    const { result } = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        featuredTabId: 'ft_1234abcd',
        currentIndex: 1,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.video?.id).toBe('target-video');
    });

    expect(result.current.featuredNavigationState).toBe('ok');
    expect(result.current.featuredTab?.id).toBe('ft_1234abcd');
    expect(mockFetchFeaturedTabVideos).toHaveBeenCalledWith(
      'https://api.divine.video',
      'ft_1234abcd',
      undefined,
      12,
      expect.any(AbortSignal)
    );
    expect(result.current.videos?.map(video => video.id)).toEqual([
      'featured-1',
      'target-video',
      'featured-3',
    ]);
    expect(result.current.windowOffset).toBe(0);
  });

  it('marks featured navigation unresolved while the tab configuration is unknown', async () => {
    mockUseFeaturedTab.mockReturnValue({
      tab: null,
      isResolved: false,
    });
    mockFetchVideoById.mockResolvedValueOnce({
      id: 'target-video',
      pubkey: 'p'.repeat(64),
      d_tag: 'target-video',
    });

    const { result } = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        featuredTabId: 'ft_1234abcd',
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.video?.id).toBe('target-video');
    });

    expect(result.current.featuredNavigationState).toBe('unresolved');
    expect(mockFetchFeaturedTabVideos).not.toHaveBeenCalled();
  });

  it('filters blocked authors out of featured navigation candidates', async () => {
    const blockedPubkey = 'b'.repeat(64);
    mockBlocklist.add(blockedPubkey);
    mockUseFeaturedTab.mockReturnValue({
      tab: { id: 'ft_1234abcd' },
      isResolved: true,
    });
    mockFetchFeaturedTabVideos.mockResolvedValueOnce({
      videos: [
        { id: 'target-video', pubkey: 'p'.repeat(64), d_tag: 'target-video' },
        { id: 'blocked-video', pubkey: blockedPubkey, d_tag: 'blocked-video' },
        { id: 'visible-video', pubkey: 'v'.repeat(64), d_tag: 'visible-video' },
      ],
      has_more: false,
    });

    const { result } = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        featuredTabId: 'ft_1234abcd',
        currentIndex: 0,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.videos?.map(video => video.id)).toEqual(['target-video', 'visible-video']);
    });
  });

  it('filters blocked authors out of profile navigation candidates', async () => {
    const blockedPubkey = 'b'.repeat(64);
    mockBlocklist.add(blockedPubkey);
    mockFetchUserVideos.mockResolvedValueOnce({
      videos: [
        { id: 'target-video', pubkey: 'p'.repeat(64), d_tag: 'target-video' },
        { id: 'blocked-video', pubkey: blockedPubkey, d_tag: 'blocked-video' },
        { id: 'visible-video', pubkey: 'v'.repeat(64), d_tag: 'visible-video' },
      ],
      has_more: false,
    });

    const { result } = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        pubkey: 'p'.repeat(64),
        currentIndex: 0,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.videos?.map(video => video.id)).toEqual(['target-video', 'visible-video']);
    });
  });

  it('walks featured cursor pages up to the index-derived budget for cold links', async () => {
    mockUseFeaturedTab.mockReturnValue({
      tab: { id: 'ft_1234abcd' },
      isResolved: true,
    });
    mockFetchFeaturedTabVideos
      .mockResolvedValueOnce({
        videos: [{ id: 'featured-1', pubkey: 'p'.repeat(64), d_tag: 'featured-1' }],
        has_more: true,
        next_cursor: 'cursor-2',
      })
      .mockResolvedValueOnce({
        videos: [{ id: 'target-video', pubkey: 'p'.repeat(64), d_tag: 'target-video' }],
        has_more: false,
        next_cursor: undefined,
      });

    const { result } = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        featuredTabId: 'ft_1234abcd',
        currentIndex: 12,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.videos?.map(video => video.id)).toEqual(['featured-1', 'target-video']);
    });

    expect(mockFetchFeaturedTabVideos).toHaveBeenNthCalledWith(
      2,
      'https://api.divine.video',
      'ft_1234abcd',
      'cursor-2',
      12,
      expect.any(AbortSignal)
    );
  });

  it('does not fetch featured neighbors when the URL tab is not currently eligible', async () => {
    mockUseFeaturedTab.mockReturnValue({
      tab: { id: 'ft_other' },
      isResolved: true,
    });
    mockFetchVideoById.mockResolvedValueOnce({
      id: 'target-video',
      pubkey: 'p'.repeat(64),
      d_tag: 'target-video',
    });

    const { result } = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        featuredTabId: 'ft_1234abcd',
        currentIndex: 1,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.video?.id).toBe('target-video');
    });

    expect(mockFetchFeaturedTabVideos).not.toHaveBeenCalled();
    expect(mockSearchVideos).not.toHaveBeenCalled();
    expect(mockFetchUserVideos).not.toHaveBeenCalled();
    expect(result.current.videos).toBeNull();
    expect(result.current.featuredNavigationState).toBe('tab-unavailable');
  });

  it('marks featured navigation out of range when an index-free link misses the first page budget', async () => {
    mockUseFeaturedTab.mockReturnValue({
      tab: { id: 'ft_1234abcd', slug: 'seasonal-theme', label: 'Seasonal' },
      isResolved: true,
    });
    mockFetchFeaturedTabVideos.mockResolvedValueOnce({
      videos: [{ id: 'featured-1', pubkey: 'p'.repeat(64), d_tag: 'featured-1' }],
      has_more: true,
      next_cursor: 'cursor-2',
    });
    mockFetchVideoById.mockResolvedValueOnce({
      id: 'target-video',
      pubkey: 'p'.repeat(64),
      d_tag: 'target-video',
    });

    const { result } = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        featuredTabId: 'ft_1234abcd',
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.video?.id).toBe('target-video');
      expect(result.current.featuredNavigationState).toBe('target-out-of-range');
    });

    expect(mockFetchFeaturedTabVideos).toHaveBeenCalledTimes(1);
    expect(mockFetchFeaturedTabVideos).toHaveBeenCalledWith(
      'https://api.divine.video',
      'ft_1234abcd',
      undefined,
      12,
      expect.any(AbortSignal)
    );
    expect(result.current.videos).toBeNull();
  });

  it('skips a fully-blocked featured page when paging for the next neighbor', async () => {
    const blockedPubkey = 'b'.repeat(64);
    mockBlocklist.add(blockedPubkey);
    mockUseFeaturedTab.mockReturnValue({
      tab: { id: 'ft_1234abcd' },
      isResolved: true,
    });
    // Page 2 is entirely blocked authors; the visible neighbor is on page 3.
    // A single-page fetch would filter to nothing and dead-end the boundary.
    mockFetchFeaturedTabVideos.mockImplementation((_apiUrl, _configId, cursor) => {
      if (!cursor) {
        return Promise.resolve({
          videos: [{ id: 'target-video', pubkey: 'p'.repeat(64), d_tag: 'target-video' }],
          has_more: true,
          next_cursor: 'cursor-2',
        });
      }
      if (cursor === 'cursor-2') {
        return Promise.resolve({
          videos: [
            { id: 'blocked-a', pubkey: blockedPubkey, d_tag: 'blocked-a' },
            { id: 'blocked-b', pubkey: blockedPubkey, d_tag: 'blocked-b' },
          ],
          has_more: true,
          next_cursor: 'cursor-3',
        });
      }
      if (cursor === 'cursor-3') {
        return Promise.resolve({
          videos: [{ id: 'visible-next', pubkey: 'v'.repeat(64), d_tag: 'visible-next' }],
          has_more: false,
        });
      }
      return Promise.resolve({ videos: [], has_more: false });
    });

    const { result } = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        featuredTabId: 'ft_1234abcd',
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.videos?.map(video => video.id)).toEqual(['target-video']);
    });

    let pagedIds: string[] | undefined;
    await act(async () => {
      const paged = await result.current.fetchNextPage();
      pagedIds = paged?.map(video => video.id);
    });

    // The all-blocked page is walked past, not surfaced as a dead-end.
    expect(pagedIds).toEqual(['target-video', 'visible-next']);
    expect(mockFetchFeaturedTabVideos).toHaveBeenCalledWith(
      'https://api.divine.video',
      'ft_1234abcd',
      'cursor-2',
      12,
      expect.any(AbortSignal)
    );
    expect(mockFetchFeaturedTabVideos).toHaveBeenCalledWith(
      'https://api.divine.video',
      'ft_1234abcd',
      'cursor-3',
      12,
      expect.any(AbortSignal)
    );
  });

  it('skips a fully-blocked search page when paging for the next neighbor', async () => {
    const blockedPubkey = 'b'.repeat(64);
    mockBlocklist.add(blockedPubkey);
    mockSearchVideos
      .mockResolvedValueOnce({
        videos: [{ id: 'target-video', pubkey: 'p'.repeat(64), d_tag: 'target-video' }],
        has_more: true,
        next_cursor: '16',
      })
      .mockResolvedValueOnce({
        videos: [
          { id: 'blocked-a', pubkey: blockedPubkey, d_tag: 'blocked-a' },
          { id: 'blocked-b', pubkey: blockedPubkey, d_tag: 'blocked-b' },
        ],
        has_more: true,
        next_cursor: '32',
      })
      .mockResolvedValueOnce({
        videos: [{ id: 'visible-next', pubkey: 'v'.repeat(64), d_tag: 'visible-next' }],
        has_more: false,
      });

    const { result } = renderHook(
      () => useVideoByIdFunnelcake({
        videoId: 'target-video',
        query: 'cats',
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.videos?.map(video => video.id)).toEqual(['target-video']);
    });

    let pagedIds: string[] | undefined;
    await act(async () => {
      const paged = await result.current.fetchNextPage();
      pagedIds = paged?.map(video => video.id);
    });

    expect(pagedIds).toEqual(['target-video', 'visible-next']);
    expect(mockSearchVideos).toHaveBeenNthCalledWith(
      2,
      'https://api.divine.video',
      expect.objectContaining({ offset: 16 })
    );
    expect(mockSearchVideos).toHaveBeenNthCalledWith(
      3,
      'https://api.divine.video',
      expect.objectContaining({ offset: 32 })
    );
  });
});
