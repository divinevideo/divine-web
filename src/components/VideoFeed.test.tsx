import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { initializeI18n } from '@/lib/i18n';
import { VideoFeed } from './VideoFeed';

const {
  mockNavigate,
  mockUseVideoProvider,
  mockEnterFullscreen,
  mockSetVideosForFullscreen,
  mockUpdateVideos,
  mockUseVideoPrefetch,
  mockInfiniteScroll,
  mockTrackEvent,
} = vi.hoisted(() => ({
  mockTrackEvent: vi.fn(),
  mockNavigate: vi.fn(),
  mockUseVideoProvider: vi.fn(),
  mockEnterFullscreen: vi.fn(),
  mockSetVideosForFullscreen: vi.fn(),
  mockUpdateVideos: vi.fn(),
  mockUseVideoPrefetch: vi.fn(),
  mockInfiniteScroll: vi.fn(),
}));

vi.mock('@/hooks/useVideoProvider', () => ({
  useVideoProvider: mockUseVideoProvider,
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: mockTrackEvent,
}));

vi.mock('@/hooks/useBatchedAuthors', () => ({
  useBatchedAuthors: vi.fn(),
}));

vi.mock('@/hooks/useModeration', () => ({
  useContentModeration: () => ({
    checkContent: () => ({ shouldFilter: false }),
  }),
}));

vi.mock('@/hooks/useFeedPerformanceInstrumentation', () => ({
  useFeedPerformanceInstrumentation: () => ({
    feedRootRef: vi.fn(),
    trackInitialRender: vi.fn(),
    trackFirstPlayback: vi.fn(),
  }),
}));

vi.mock('@/hooks/useProofModeEnrichment', () => ({
  useProofModeEnrichment: <T,>(videos: T) => videos,
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/contexts/FullscreenFeedContext', () => ({
  useFullscreenFeed: () => ({
    setVideosForFullscreen: mockSetVideosForFullscreen,
    enterFullscreen: mockEnterFullscreen,
    updateVideos: mockUpdateVideos,
  }),
}));

vi.mock('@/hooks/useVideoPlayback', () => ({
  useVideoPlayback: () => ({
    activeVideoId: null,
  }),
}));

vi.mock('@/hooks/useVideoPrefetch', () => ({
  useVideoPrefetch: mockUseVideoPrefetch,
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));

vi.mock('@/lib/performanceMonitoring', () => ({
  performanceMonitor: {
    recordMetric: vi.fn(),
  },
}));

vi.mock('@/components/VideoCardWithMetrics', () => ({
  VideoCardWithMetrics: () => <div data-testid="video-card" />,
}));

vi.mock('@/components/VideoGrid', () => ({
  VideoGrid: () => <div data-testid="video-grid" />,
}));

vi.mock('@/components/AddToListDialog', () => ({
  AddToListDialog: () => null,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('react-infinite-scroll-component', () => ({
  default: ({ children, dataLength }: { children: ReactNode; dataLength: number }) => {
    mockInfiniteScroll({ dataLength });
    return <div>{children}</div>;
  },
}));

describe('VideoFeed', () => {
  beforeEach(async () => {
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
    vi.clearAllMocks();
    mockUseVideoProvider.mockReturnValue({
      data: {
        pages: [{
          videos: [{
            id: 'video-1',
            pubkey: 'a'.repeat(64),
            videoUrl: 'https://example.com/video-1.mp4',
          }],
        }],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      fetchedCount: 1,
      dataSource: 'funnelcake',
    });
  });

  it('renders a compilation launcher for eligible feed-backed sources', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/discovery/classics']}>
        <VideoFeed feedType="classics" viewMode="grid" mode="thumbnail" />
      </MemoryRouter>
    );

    const button = await screen.findByRole('button', { name: /play all/i });
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/discovery/classics?play=compilation&start=0');
  });

  it('preserves discovery tab context in the compilation url', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/discovery/hot']}>
        <VideoFeed feedType="trending" sortMode="hot" viewMode="grid" mode="thumbnail" />
      </MemoryRouter>
    );

    const button = await screen.findByRole('button', { name: /play all/i });
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/discovery/hot?play=compilation&start=0&sort=hot');
  });

  it('auto-opens the existing fullscreen feed when compilation mode is present in the source url', () => {
    render(
      <MemoryRouter initialEntries={['/discovery/classics?play=compilation&start=0']}>
        <VideoFeed feedType="classics" viewMode="grid" mode="thumbnail" />
      </MemoryRouter>
    );

    expect(mockEnterFullscreen).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'video-1' })],
      0,
    );
  });

  it('reports one featured impression per mount, not one per appended page', () => {
    const makeVideos = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        id: `video-${index + 1}`,
        pubkey: 'a'.repeat(64),
        videoUrl: `https://example.com/video-${index + 1}.mp4`,
      }));

    mockUseVideoProvider.mockReturnValue({
      data: { pages: [{ videos: makeVideos(1) }] },
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      fetchedCount: 1,
      dataSource: 'funnelcake',
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/discovery/seasonal-theme']}>
        <VideoFeed feedType="featured" featuredTabId="ft_1234abcd" />
      </MemoryRouter>
    );

    expect(mockTrackEvent).toHaveBeenCalledExactlyOnceWith('featured_tab_video_impression', {
      featured_tab_id: 'ft_1234abcd',
      rendered_videos: 1,
    });

    // Second page arrives; the impression must not be counted again.
    mockUseVideoProvider.mockReturnValue({
      data: { pages: [{ videos: makeVideos(1) }, { videos: makeVideos(3).slice(1) }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      fetchedCount: 3,
      dataSource: 'funnelcake',
    });

    rerender(
      <MemoryRouter initialEntries={['/discovery/seasonal-theme']}>
        <VideoFeed feedType="featured" featuredTabId="ft_1234abcd" />
      </MemoryRouter>
    );

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  });

  it('does not prefetch full video files before first playback', () => {
    render(
      <MemoryRouter initialEntries={['/popular']}>
        <VideoFeed feedType="popular" />
      </MemoryRouter>
    );

    expect(mockUseVideoPrefetch).toHaveBeenCalledWith(
      null,
      [expect.objectContaining({ id: 'video-1' })],
      { prefetchVideos: false },
    );
  });

  it('keys infinite scroll from fetched count instead of filtered rendered count', () => {
    mockUseVideoProvider.mockReturnValue({
      data: {
        pages: [{
          videos: [
            {
              id: 'video-1',
              pubkey: 'a'.repeat(64),
              kind: 34236,
              vineId: 'same-address',
              videoUrl: 'https://example.com/video-1.mp4',
            },
            {
              id: 'video-2',
              pubkey: 'a'.repeat(64),
              kind: 34236,
              vineId: 'same-address',
              videoUrl: 'https://example.com/video-2.mp4',
            },
          ],
        }],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      fetchedCount: 2,
      dataSource: 'funnelcake',
    });

    render(
      <MemoryRouter initialEntries={['/discovery']}>
        <VideoFeed feedType="discovery" />
      </MemoryRouter>
    );

    expect(screen.getAllByTestId('video-card')).toHaveLength(1);
    expect(mockInfiniteScroll).toHaveBeenCalledWith({ dataLength: 2 });
  });
});
