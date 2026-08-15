import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { HTMLAttributes, ReactNode } from 'react';
import VideoPage from './VideoPage';
import { initializeI18n } from '@/lib/i18n';

const { VIDEO_1_AUTHOR_PK, VIDEO_2_AUTHOR_PK, VIDEO_3_AUTHOR_PK, VIEWER_PK } = vi.hoisted(() => ({
  VIDEO_1_AUTHOR_PK: 'a'.repeat(64),
  VIDEO_2_AUTHOR_PK: 'b'.repeat(64),
  VIDEO_3_AUTHOR_PK: 'c'.repeat(64),
  VIEWER_PK: 'f'.repeat(64),
}));

const { mockNavigate, mockFetchNextFunnelcakePage, mockToast, mockUseVideoNavigation } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockFetchNextFunnelcakePage: vi.fn(),
  mockToast: vi.fn(),
  mockUseVideoNavigation: vi.fn(),
}));

const { openLoginDialogMock } = vi.hoisted(() => ({
  openLoginDialogMock: vi.fn(),
}));

const { publishAsyncMock, currentUser } = vi.hoisted(() => ({
  publishAsyncMock: vi.fn(),
  currentUser: { value: null as { pubkey: string } | null },
}));

vi.mock('@unhead/react', () => ({
  useSeoMeta: vi.fn(),
  useHead: vi.fn(),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useVideoByIdFunnelcake', () => ({
  useVideoByIdFunnelcake: (options: { videoId: string; query?: string; featuredTabId?: string }) => {
    const videos = [
      {
        id: 'video-1',
        pubkey: VIDEO_1_AUTHOR_PK,
        kind: 34236,
        createdAt: 1,
        content: 'one',
        videoUrl: 'https://example.com/1.mp4',
        vineId: null,
        hashtags: [],
        reposts: [],
      },
      {
        id: 'video-2',
        pubkey: VIDEO_2_AUTHOR_PK,
        kind: 34236,
        createdAt: 2,
        content: 'two',
        videoUrl: 'https://example.com/2.mp4',
        vineId: 'vine-two',
        hashtags: [],
        reposts: [],
      },
      {
        id: 'video-3',
        pubkey: VIDEO_3_AUTHOR_PK,
        kind: 34236,
        createdAt: 3,
        content: 'three',
        videoUrl: 'https://example.com/3.mp4',
        vineId: 'vine-three',
        hashtags: [],
        reposts: [],
      },
    ];

    const video = videos.find((v) => v.id === options.videoId) ?? videos[1];

    if (options.query === 'twerking') {
      return {
        video,
        videos,
        featuredNavigationState: 'not-featured',
        featuredTab: null,
        windowOffset: 0,
        fetchedCount: videos.length,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: vi.fn(),
        isLoading: false,
        error: null,
      };
    }

    if (options.query === 'scroll-window') {
      const scrollVideos = Array.from({ length: 12 }, (_, index) => ({
        id: `scroll-video-${index + 1}`,
        pubkey: VIDEO_2_AUTHOR_PK,
        kind: 34236,
        createdAt: index + 1,
        content: `scroll ${index + 1}`,
        videoUrl: `https://example.com/scroll-${index + 1}.mp4`,
        vineId: `scroll-vine-${index + 1}`,
        hashtags: [],
        reposts: [],
      }));

      return {
        video: scrollVideos[0],
        videos: scrollVideos,
        featuredNavigationState: 'not-featured',
        featuredTab: null,
        windowOffset: 0,
        fetchedCount: scrollVideos.length,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: mockFetchNextFunnelcakePage,
        isLoading: false,
        error: null,
      };
    }

    if (options.query === 'scroll-fetch') {
      const scrollVideos = Array.from({ length: 10 }, (_, index) => ({
        id: `fetch-video-${index + 1}`,
        pubkey: VIDEO_2_AUTHOR_PK,
        kind: 34236,
        createdAt: index + 1,
        content: `fetch ${index + 1}`,
        videoUrl: `https://example.com/fetch-${index + 1}.mp4`,
        vineId: `fetch-vine-${index + 1}`,
        hashtags: [],
        reposts: [],
      }));

      return {
        video: scrollVideos[0],
        videos: scrollVideos,
        featuredNavigationState: 'not-featured',
        featuredTab: null,
        windowOffset: 0,
        fetchedCount: scrollVideos.length,
        hasNextPage: true,
        isFetchingNextPage: false,
        fetchNextPage: mockFetchNextFunnelcakePage,
        isLoading: false,
        error: null,
      };
    }

    if (options.query === 'scroll-error') {
      const scrollVideos = Array.from({ length: 10 }, (_, index) => ({
        id: `error-video-${index + 1}`,
        pubkey: VIDEO_2_AUTHOR_PK,
        kind: 34236,
        createdAt: index + 1,
        content: `error ${index + 1}`,
        videoUrl: `https://example.com/error-${index + 1}.mp4`,
        vineId: `error-vine-${index + 1}`,
        hashtags: [],
        reposts: [],
      }));

      return {
        video: scrollVideos[0],
        videos: scrollVideos,
        featuredNavigationState: 'not-featured',
        featuredTab: null,
        windowOffset: 0,
        fetchedCount: scrollVideos.length,
        hasNextPage: true,
        isFetchingNextPage: false,
        fetchNextPage: mockFetchNextFunnelcakePage,
        isLoading: false,
        error: null,
      };
    }

    if (options.query === 'scroll-done') {
      const scrollVideos = Array.from({ length: 11 }, (_, index) => ({
        id: `done-video-${index + 1}`,
        pubkey: VIDEO_2_AUTHOR_PK,
        kind: 34236,
        createdAt: index + 1,
        content: `done ${index + 1}`,
        videoUrl: `https://example.com/done-${index + 1}.mp4`,
        vineId: `done-vine-${index + 1}`,
        hashtags: [],
        reposts: [],
      }));

      return {
        video: scrollVideos[0],
        videos: scrollVideos,
        featuredNavigationState: 'not-featured',
        featuredTab: null,
        windowOffset: 0,
        fetchedCount: scrollVideos.length,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: vi.fn(),
        isLoading: false,
        error: null,
      };
    }

    if (options.query === 'filtered-index') {
      return {
        video: {
          ...videos[0],
          navigationIndex: 5,
        },
        videos: [
          {
            ...videos[0],
            navigationIndex: 5,
          },
          {
            ...videos[1],
            navigationIndex: 7,
          },
        ],
        featuredNavigationState: 'not-featured',
        featuredTab: null,
        windowOffset: 4,
        fetchedCount: 3,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: vi.fn(),
        isLoading: false,
        error: null,
      };
    }

    if (options.featuredTabId === 'ft_1234abcd') {
      mockFetchNextFunnelcakePage.mockResolvedValueOnce([videos[1], videos[2]]);

      return {
        video: videos[1],
        videos: [videos[1]],
        featuredNavigationState: 'ok',
        featuredTab: { id: 'ft_1234abcd', slug: 'seasonal-theme', label: 'Seasonal' },
        windowOffset: 1,
        fetchedCount: 1,
        hasNextPage: true,
        isFetchingNextPage: false,
        fetchNextPage: mockFetchNextFunnelcakePage,
        isLoading: false,
        error: null,
      };
    }

    if (options.query === 'nav-during-fetch') {
      // Next video is already loaded, but a background scroll fetch is in flight.
      return {
        video: videos[0],
        videos,
        featuredNavigationState: 'not-featured',
        featuredTab: null,
        windowOffset: 0,
        fetchedCount: videos.length,
        hasNextPage: true,
        isFetchingNextPage: true,
        fetchNextPage: mockFetchNextFunnelcakePage,
        isLoading: false,
        error: null,
      };
    }

    if (options.featuredTabId === 'ft_slow' || options.featuredTabId === 'ft_empty') {
      return {
        video: videos[1],
        videos: [videos[1]],
        featuredNavigationState: 'ok',
        featuredTab: { id: options.featuredTabId, slug: 'seasonal-theme', label: 'Seasonal' },
        windowOffset: 1,
        fetchedCount: 1,
        hasNextPage: true,
        isFetchingNextPage: false,
        fetchNextPage: mockFetchNextFunnelcakePage,
        isLoading: false,
        error: null,
      };
    }

    if (options.featuredTabId === 'ft_unavailable') {
      return {
        video: videos[1],
        videos: null,
        featuredNavigationState: 'tab-unavailable',
        featuredTab: null,
        windowOffset: 0,
        fetchedCount: 0,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: vi.fn(),
        isLoading: false,
        error: null,
      };
    }

    // The URL tab is gone, but a *different* featured tab is eligible now — the
    // shape useFeaturedTab actually returns when one editorial window closes and
    // the next opens.
    if (options.featuredTabId === 'ft_unavailable_superseded') {
      return {
        video: videos[1],
        videos: null,
        featuredNavigationState: 'tab-unavailable',
        featuredTab: { id: 'ft_successor', slug: 'successor-tab', label: 'Successor' },
        windowOffset: 0,
        fetchedCount: 0,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: vi.fn(),
        isLoading: false,
        error: null,
      };
    }

    if (options.featuredTabId === 'ft_out_of_range') {
      return {
        video: videos[1],
        videos: null,
        featuredNavigationState: 'target-out-of-range',
        featuredTab: { id: 'ft_out_of_range', slug: 'live-tab', label: 'Live Tab' },
        windowOffset: 0,
        fetchedCount: 12,
        hasNextPage: true,
        isFetchingNextPage: false,
        fetchNextPage: vi.fn(),
        isLoading: false,
        error: null,
      };
    }

    return {
      video,
      videos: null,
      featuredNavigationState: 'not-featured',
      featuredTab: null,
      windowOffset: 0,
      fetchedCount: 0,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      isLoading: false,
      error: null,
    };
  },
}));

vi.mock('@/hooks/useVideoNavigation', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useVideoNavigation')>('@/hooks/useVideoNavigation');

  return {
    ...actual,
    useVideoNavigation: mockUseVideoNavigation,
  };
});

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: { metadata: { display_name: 'Author' } },
  }),
}));

vi.mock('@/hooks/useBatchedVideoInteractions', () => ({
  useBatchedVideoInteractions: () => ({
    interactions: new Map(),
  }),
}));

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: publishAsyncMock,
  }),
}));

vi.mock('@/hooks/usePublishVideo', () => ({
  useRepostVideo: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: currentUser.value,
  }),
}));

vi.mock('@/hooks/useVideoSocialMetrics', () => ({
  useVideoSocialMetrics: () => ({
    data: null,
  }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/contexts/LoginDialogContext', () => ({
  useLoginDialog: () => ({
    isOpen: false,
    openLoginDialog: openLoginDialogMock,
    closeLoginDialog: vi.fn(),
  }),
}));

vi.mock('@/components/VideoCard', () => ({
  VideoCard: ({ video, onLike, onRepost }: { video: { id: string }; onLike?: () => void; onRepost?: () => void }) => (
    <div data-testid="video-card">
      {video.id}
      <button aria-label="Like video" onClick={onLike} />
      <button aria-label="Repost video" onClick={onRepost} />
    </div>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: HTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock('react-infinite-scroll-component', () => ({
  default: ({
    children,
    dataLength,
    hasMore,
    next,
    endMessage,
  }: {
    children: ReactNode;
    dataLength: number;
    hasMore: boolean;
    next: () => void | Promise<void>;
    endMessage?: ReactNode;
  }) => (
    <div data-testid="infinite-scroll" data-length={dataLength} data-has-more={String(hasMore)}>
      <button type="button" onClick={() => void next()}>
        Load more
      </button>
      {children}
      {!hasMore && endMessage}
    </div>
  ),
}));

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/video/:id" element={<VideoPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('VideoPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetchNextFunnelcakePage.mockReset();
    mockToast.mockReset();
    mockUseVideoNavigation.mockReturnValue({
      context: null,
      currentVideo: null,
      videos: null,
      hasNext: false,
      hasPrevious: false,
      goToNext: vi.fn(),
      goToPrevious: vi.fn(),
      isLoading: false,
    });
    currentUser.value = null;
    publishAsyncMock.mockResolvedValue({ id: 'like-event-id' });
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
    });
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  it('navigates through bounded search results while preserving search params', () => {
    renderPage('/video/video-2?source=search&q=twerking&sort=top&index=1');

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [target] = mockNavigate.mock.calls[0] ?? [];
    expect(target).toBeTypeOf('string');

    const url = new URL(String(target), 'https://divine.video');
    expect(url.pathname).toBe('/video/video-3');
    expect(url.searchParams.get('source')).toBe('search');
    expect(url.searchParams.get('q')).toBe('twerking');
    expect(url.searchParams.get('sort')).toBe('top');
    expect(url.searchParams.get('index')).toBe('2');
  });

  it('fetches the next featured page at the boundary while preserving featured params', async () => {
    renderPage('/video/video-2?source=featured&featuredTabId=ft_1234abcd&index=1');

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
    expect(mockFetchNextFunnelcakePage).toHaveBeenCalledTimes(1);

    const [target] = mockNavigate.mock.calls[0] ?? [];
    const url = new URL(String(target), 'https://divine.video');
    expect(url.pathname).toBe('/video/video-3');
    expect(url.searchParams.get('source')).toBe('featured');
    expect(url.searchParams.get('featuredTabId')).toBe('ft_1234abcd');
    expect(url.searchParams.get('index')).toBe('2');
  });

  it('rewrites onward navigation to trending when a featured tab is unavailable', async () => {
    mockUseVideoNavigation.mockReturnValue({
      context: { source: 'trending' },
      currentVideo: {
        id: 'video-2',
        pubkey: VIDEO_2_AUTHOR_PK,
        kind: 34236,
        createdAt: 2,
        content: 'two',
        videoUrl: 'https://example.com/2.mp4',
        vineId: 'vine-two',
        hashtags: [],
        reposts: [],
      },
      videos: [
        {
          id: 'video-2',
          pubkey: VIDEO_2_AUTHOR_PK,
          kind: 34236,
          createdAt: 2,
          content: 'two',
          videoUrl: 'https://example.com/2.mp4',
          vineId: 'vine-two',
          hashtags: [],
          reposts: [],
        },
        {
          id: 'video-3',
          pubkey: VIDEO_3_AUTHOR_PK,
          kind: 34236,
          createdAt: 3,
          content: 'three',
          videoUrl: 'https://example.com/3.mp4',
          vineId: 'vine-three',
          hashtags: [],
          reposts: [],
        },
      ],
      hasNext: true,
      hasPrevious: false,
      goToNext: vi.fn(),
      goToPrevious: vi.fn(),
      isLoading: false,
    });

    renderPage('/video/video-2?source=featured&featuredTabId=ft_unavailable&index=1');

    expect(mockUseVideoNavigation).toHaveBeenCalledWith('video-2', {
      enabled: true,
      context: { source: 'trending' },
    });
    expect(screen.getByText("That featured tab wrapped. Here's trending.")).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    const [target] = mockNavigate.mock.calls[0] ?? [];
    const url = new URL(String(target), 'https://divine.video');
    expect(url.pathname).toBe('/video/video-3');
    expect(url.searchParams.get('source')).toBe('trending');
    expect(url.searchParams.has('featuredTabId')).toBe(false);
  });

  it('does not send the trending fallback back to a successor featured tab', () => {
    const videoTwo = {
      id: 'video-2',
      pubkey: VIDEO_2_AUTHOR_PK,
      kind: 34236,
      createdAt: 2,
      content: 'two',
      videoUrl: 'https://example.com/2.mp4',
      vineId: 'vine-two',
      hashtags: [],
      reposts: [],
    };

    mockUseVideoNavigation.mockReturnValue({
      context: { source: 'trending' },
      currentVideo: videoTwo,
      videos: [videoTwo],
      hasNext: false,
      hasPrevious: false,
      goToNext: vi.fn(),
      goToPrevious: vi.fn(),
      isLoading: false,
    });

    renderPage('/video/video-2?source=featured&featuredTabId=ft_unavailable_superseded&index=1');

    expect(screen.getByText("That featured tab wrapped. Here's trending.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /trending/i }));

    // The link reads "Trending", so it must not land on the unrelated featured
    // tab that happens to be eligible now.
    expect(mockNavigate).not.toHaveBeenCalledWith('/discovery/successor-tab');
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('stops featured neighbor navigation when the target is outside the live tab window', () => {
    renderPage('/video/video-2?source=featured&featuredTabId=ft_out_of_range');

    expect(mockUseVideoNavigation).toHaveBeenCalledWith('video-2', {
      enabled: false,
      context: expect.objectContaining({
        source: 'featured',
        featuredTabId: 'ft_out_of_range',
      }),
    });
    expect(screen.getByText('This video is still here, but it is not in the loaded tab window anymore.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Live Tab' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next video/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to Live Tab' }));

    expect(mockNavigate).toHaveBeenCalledWith('/discovery/live-tab');
  });

  it('advances infinite-scroll data length when widening the rendered window', async () => {
    renderPage('/video/scroll-video-1?source=search&q=scroll-window&index=0');

    const scroll = screen.getByTestId('infinite-scroll');
    expect(scroll).toHaveAttribute('data-length', '22');
    expect(scroll).toHaveAttribute('data-has-more', 'true');

    fireEvent.click(screen.getByRole('button', { name: /load more/i }));

    await waitFor(() => {
      expect(screen.getByTestId('infinite-scroll')).toHaveAttribute('data-length', '24');
    });
    expect(mockFetchNextFunnelcakePage).not.toHaveBeenCalled();
  });

  it('fetches the next Funnelcake page when the rendered window is exhausted', async () => {
    mockFetchNextFunnelcakePage.mockResolvedValueOnce([]);

    renderPage('/video/fetch-video-1?source=search&q=scroll-fetch&index=0');

    const scroll = screen.getByTestId('infinite-scroll');
    expect(scroll).toHaveAttribute('data-length', '20');
    expect(scroll).toHaveAttribute('data-has-more', 'true');

    fireEvent.click(screen.getByRole('button', { name: /load more/i }));

    await waitFor(() => {
      expect(mockFetchNextFunnelcakePage).toHaveBeenCalledTimes(1);
    });
  });

  it('shows feedback when a scroll-triggered Funnelcake page fails', async () => {
    mockFetchNextFunnelcakePage.mockRejectedValueOnce(new Error('network down'));

    renderPage('/video/error-video-1?source=search&q=scroll-error&index=0');

    fireEvent.click(screen.getByRole('button', { name: /load more/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        description: "Couldn't load more videos. Try again?",
        variant: 'destructive',
      }));
    });
  });

  it('shows an end message when the loaded feed has no more rows or pages', () => {
    renderPage('/video/done-video-9?source=search&q=scroll-done&index=8');

    expect(screen.getByTestId('infinite-scroll')).toHaveAttribute('data-has-more', 'false');
    expect(screen.getByText("That's the whole haul.")).toBeInTheDocument();
  });

  it('uses the server navigation index carried by filtered Funnelcake pages', async () => {
    renderPage('/video/video-1?source=search&q=filtered-index&index=5');

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    const [target] = mockNavigate.mock.calls[0] ?? [];
    const url = new URL(String(target), 'https://divine.video');
    expect(url.pathname).toBe('/video/video-2');
    expect(url.searchParams.get('index')).toBe('7');
  });

  it('navigates to an already-loaded next video while a page fetch is in flight', async () => {
    renderPage('/video/video-1?source=search&q=nav-during-fetch&index=0');

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
    // The next video was already loaded, so no extra page fetch is needed.
    expect(mockFetchNextFunnelcakePage).not.toHaveBeenCalled();
  });

  it('ignores repeated next navigation while a boundary fetch is in flight', async () => {
    let resolveNextPage: (videos: Array<{ id: string; pubkey: string; kind: number; createdAt: number; content: string; videoUrl: string; vineId: string | null; hashtags: string[]; reposts: unknown[] }>) => void;
    mockFetchNextFunnelcakePage.mockImplementationOnce(() => new Promise(resolve => {
      resolveNextPage = resolve;
    }));

    renderPage('/video/video-2?source=featured&featuredTabId=ft_slow&index=1');

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    fireEvent.keyDown(document.body, { key: 'ArrowDown' });

    expect(mockFetchNextFunnelcakePage).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();

    resolveNextPage!([{
      id: 'video-2',
      pubkey: VIDEO_2_AUTHOR_PK,
      kind: 34236,
      createdAt: 2,
      content: 'two',
      videoUrl: 'https://example.com/2.mp4',
      vineId: 'vine-two',
      hashtags: [],
      reposts: [],
    }, {
      id: 'video-3',
      pubkey: VIDEO_3_AUTHOR_PK,
      kind: 34236,
      createdAt: 3,
      content: 'three',
      videoUrl: 'https://example.com/3.mp4',
      vineId: 'vine-three',
      hashtags: [],
      reposts: [],
    }]);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
  });

  it('shows feedback when a visible next page produces no next video', async () => {
    mockFetchNextFunnelcakePage.mockResolvedValueOnce([{
      id: 'video-2',
      pubkey: VIDEO_2_AUTHOR_PK,
      kind: 34236,
      createdAt: 2,
      content: 'two',
      videoUrl: 'https://example.com/2.mp4',
      vineId: 'vine-two',
      hashtags: [],
      reposts: [],
    }]);

    renderPage('/video/video-2?source=featured&featuredTabId=ft_empty&index=1');

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        description: "Couldn't load the next video. Try again?",
        variant: 'destructive',
      }));
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens the login dialog when a signed-out viewer likes or reposts', () => {
    renderPage('/video/video-2');

    fireEvent.click(screen.getByRole('button', { name: /like video/i }));
    expect(openLoginDialogMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /repost video/i }));
    expect(openLoginDialogMock).toHaveBeenCalledTimes(2);
  });

  it('likes with the video coordinate so the reaction survives an edit', async () => {
    currentUser.value = { pubkey: VIEWER_PK };

    renderPage('/video/video-2');

    fireEvent.click(screen.getByRole('button', { name: /like video/i }));

    await waitFor(() => expect(publishAsyncMock).toHaveBeenCalledTimes(1));
    expect(publishAsyncMock).toHaveBeenCalledWith({
      kind: 7,
      content: '+',
      tags: [
        ['e', 'video-2'],
        ['a', `34236:${VIDEO_2_AUTHOR_PK}:vine-two`],
        ['p', VIDEO_2_AUTHOR_PK],
        ['k', '34236'],
      ],
    });
  });

  it('omits the coordinate when the video has no d tag to address it by', async () => {
    currentUser.value = { pubkey: VIEWER_PK };

    renderPage('/video/video-1');

    fireEvent.click(screen.getByRole('button', { name: /like video/i }));

    await waitFor(() => expect(publishAsyncMock).toHaveBeenCalledTimes(1));
    expect(publishAsyncMock).toHaveBeenCalledWith({
      kind: 7,
      content: '+',
      tags: [
        ['e', 'video-1'],
        ['p', VIDEO_1_AUTHOR_PK],
        ['k', '34236'],
      ],
    });
  });
});
