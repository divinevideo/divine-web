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

const { mockNavigate, mockFetchNextFunnelcakePage, mockToast } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockFetchNextFunnelcakePage: vi.fn(),
  mockToast: vi.fn(),
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
        windowOffset: 0,
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
        windowOffset: 1,
        hasNextPage: true,
        isFetchingNextPage: false,
        fetchNextPage: mockFetchNextFunnelcakePage,
        isLoading: false,
        error: null,
      };
    }

    if (options.featuredTabId === 'ft_slow' || options.featuredTabId === 'ft_empty') {
      return {
        video: videos[1],
        videos: [videos[1]],
        windowOffset: 1,
        hasNextPage: true,
        isFetchingNextPage: false,
        fetchNextPage: mockFetchNextFunnelcakePage,
        isLoading: false,
        error: null,
      };
    }

    return {
      video,
      videos: null,
      windowOffset: 0,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      isLoading: false,
      error: null,
    };
  },
}));

vi.mock('@/hooks/useVideoNavigation', () => ({
  buildVideoNavigationUrl: (videoId: string, context: {
    source: string;
    hashtag?: string;
    pubkey?: string;
    listId?: string;
    featuredTabId?: string;
    query?: string;
    sortMode?: string;
  }, index?: number) => {
    const params = new URLSearchParams({ source: context.source });
    if (context.hashtag) params.set('hashtag', context.hashtag);
    if (context.pubkey) params.set('pubkey', context.pubkey);
    if (context.listId) params.set('listId', context.listId);
    if (context.featuredTabId) params.set('featuredTabId', context.featuredTabId);
    if (context.query) params.set('q', context.query);
    if (context.sortMode) params.set('sort', context.sortMode);
    if (index !== undefined) params.set('index', String(index));
    return `/video/${videoId}?${params.toString()}`;
  },
  parseVideoNavigationContext: (searchParams: URLSearchParams) => {
    const source = searchParams.get('source');
    if (!source) return null;
    return {
      source,
      hashtag: searchParams.get('hashtag') || undefined,
      pubkey: searchParams.get('pubkey') || undefined,
      listId: searchParams.get('listId') || undefined,
      featuredTabId: searchParams.get('featuredTabId') || undefined,
      query: searchParams.get('q') || undefined,
      sortMode: searchParams.get('sort') || undefined,
      currentIndex: searchParams.get('index') ? parseInt(searchParams.get('index')!, 10) : undefined,
    };
  },
  useVideoNavigation: () => ({
    context: null,
    currentVideo: null,
    videos: null,
    hasNext: false,
    hasPrevious: false,
    goToNext: vi.fn(),
    goToPrevious: vi.fn(),
    isLoading: false,
  }),
}));

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
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
