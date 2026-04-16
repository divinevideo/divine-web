import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { VideoFeed } from './VideoFeed';

const { mockNavigate, mockUseVideoProvider, mockEnterFullscreen, mockSetVideosForFullscreen, mockUpdateVideos } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseVideoProvider: vi.fn(),
  mockEnterFullscreen: vi.fn(),
  mockSetVideosForFullscreen: vi.fn(),
  mockUpdateVideos: vi.fn(),
}));

vi.mock('@/hooks/useVideoProvider', () => ({
  useVideoProvider: mockUseVideoProvider,
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
  useVideoPrefetch: vi.fn(),
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
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('VideoFeed', () => {
  beforeEach(() => {
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
});
