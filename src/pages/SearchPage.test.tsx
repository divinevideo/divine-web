import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ImgHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';
import { nip19 } from 'nostr-tools';
import SearchPage from './SearchPage';

const {
  mockNavigate,
  mockFetchEventById,
  mockFetchVideoById,
  mockNostrQuery,
  mockUseInfiniteSearchVideos,
  mockEnterFullscreen,
  mockSetVideosForFullscreen,
  mockUpdateVideos,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockFetchEventById: vi.fn(),
  mockFetchVideoById: vi.fn(),
  mockNostrQuery: vi.fn(),
  mockUseInfiniteSearchVideos: vi.fn(),
  mockEnterFullscreen: vi.fn(),
  mockSetVideosForFullscreen: vi.fn(),
  mockUpdateVideos: vi.fn(),
}));

vi.mock('@unhead/react', () => ({
  useSeoMeta: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackSearch: vi.fn(),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h3 {...props}>{children}</h3>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AvatarImage: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
  AvatarFallback: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

// Bare VideoCard mock: search results MUST NOT render this directly because
// it has no metrics wrapper, which means viewCount/loopCount can never display.
// The presence of `bare-video-card-*` in a test render is a regression.
vi.mock('@/components/VideoCard', () => ({
  VideoCard: ({ video }: { video: { id: string } }) => (
    <div data-testid={`bare-video-card-${video.id}`}>bare {video.id}</div>
  ),
}));

vi.mock('@/components/VideoCardWithMetrics', () => ({
  VideoCardWithMetrics: ({
    video,
    navigationContext,
    index,
  }: {
    video: { id: string };
    navigationContext?: { source: string; query?: string; sortMode?: string };
    index?: number;
  }) => {
    const href = navigationContext
      ? `/video/${video.id}?source=${navigationContext.source}&q=${navigationContext.query}&sort=${navigationContext.sortMode}&index=${index}`
      : `/video/${video.id}`;

    return (
      <button data-testid={`video-card-${video.id}`} onClick={() => mockNavigate(href)}>
        open {video.id}
      </button>
    );
  },
}));

vi.mock('react-infinite-scroll-component', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: {
      relayUrl: 'wss://relay.divine.video',
      relayUrls: ['wss://relay.divine.video'],
    },
  }),
}));

vi.mock('@/hooks/useInfiniteSearchVideos', () => ({
  useInfiniteSearchVideos: mockUseInfiniteSearchVideos,
}));

vi.mock('@/hooks/useSearchUsers', () => ({
  useSearchUsers: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useSearchHashtags', () => ({
  useSearchHashtags: ({ query }: { query: string }) => ({
    data: query ? [] : [],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/lib/funnelcakeClient', () => ({
  fetchVideoById: mockFetchVideoById,
}));

vi.mock('@/lib/eventLookup', () => ({
  fetchEventById: mockFetchEventById,
}));

function renderPage(initialEntries: string[] = ['/search']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SearchPage />
      <LocationDisplay />
    </MemoryRouter>
  );
}

function LocationDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location-display">
      {location.pathname}
      {location.search}
    </div>
  );
}

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInfiniteSearchVideos.mockReturnValue({
      data: { pages: [{ videos: [] }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears the blur suggestion timeout on unmount', async () => {
    vi.useFakeTimers();

    const { unmount } = renderPage();
    const input = screen.getByRole('textbox');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('navigates directly when the query is an npub', () => {
    const npub = nip19.npubEncode('f'.repeat(64));

    renderPage();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: npub } });

    expect(mockNavigate).toHaveBeenCalledWith(`/profile/${npub}`);
    expect(mockFetchVideoById).not.toHaveBeenCalled();
  });

  it('navigates immediately when a Vine clip URL is pasted', () => {
    renderPage();
    const input = screen.getByRole('textbox');

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => 'https://vine.co/v/hBFP5LFKUOU',
      },
    });

    expect(mockNavigate).toHaveBeenCalledWith('/video/hBFP5LFKUOU');
    expect(mockFetchVideoById).not.toHaveBeenCalled();
  });

  it('navigates immediately when a Vine user URL is pasted', () => {
    renderPage();
    const input = screen.getByRole('textbox');

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => 'https://vine.co/u/1080167736266633216',
      },
    });

    expect(mockNavigate).toHaveBeenCalledWith('/u/1080167736266633216');
    expect(mockFetchVideoById).not.toHaveBeenCalled();
  });

  it('looks up pasted short d tags and navigates to the matching video', async () => {
    mockFetchVideoById.mockResolvedValue({
      id: 'e'.repeat(64),
      d_tag: 'clip-7',
    });

    renderPage();
    const input = screen.getByRole('textbox');

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => 'clip-7',
      },
    });
    fireEvent.change(input, { target: { value: 'clip-7' } });

    await waitFor(() => {
      expect(mockFetchVideoById).toHaveBeenCalledWith(
        'https://api.divine.video',
        'clip-7',
        undefined,
        expect.any(AbortSignal),
      );
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/video/clip-7');
    });
  });

  it('resolves bare pasted Vine clip IDs through the opaque video lookup flow', async () => {
    vi.useFakeTimers();
    mockFetchVideoById.mockResolvedValue({
      id: 'e'.repeat(64),
      d_tag: 'hBFP5LFKUOU',
    });

    renderPage();
    const input = screen.getByRole('textbox');

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => 'hBFP5LFKUOU',
      },
    });
    fireEvent.change(input, { target: { value: 'hBFP5LFKUOU' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
      await Promise.resolve();
    });

    expect(mockFetchVideoById).toHaveBeenCalledWith(
      'https://api.divine.video',
      'hBFP5LFKUOU',
      undefined,
      expect.any(AbortSignal),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/video/hBFP5LFKUOU');
  });

  it('looks up raw event ids beyond the funnelcake api fallback', async () => {
    vi.useFakeTimers();

    const eventId = 'e'.repeat(64);
    mockFetchEventById.mockResolvedValue({
      id: eventId,
      pubkey: 'f'.repeat(64),
      created_at: 1_700_000_000,
      kind: 1,
      tags: [],
      content: 'hello',
      sig: '0'.repeat(128),
    });

    renderPage();
    await act(async () => {
      fireEvent.change(screen.getByRole('textbox'), { target: { value: eventId } });
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(mockFetchEventById).toHaveBeenCalledWith(
      { query: mockNostrQuery },
      eventId,
      expect.any(AbortSignal),
      { relayUrls: ['wss://relay.divine.video'] },
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockNavigate).toHaveBeenCalledWith(`/event/${eventId}`);
  });

  it('opens video results with bounded search context', async () => {
    mockUseInfiniteSearchVideos.mockReturnValue({
      data: {
        pages: [{
          videos: [
            { id: 'video-1', pubkey: 'a'.repeat(64) },
            { id: 'video-2', pubkey: 'b'.repeat(64) },
          ],
        }],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isLoading: false,
      error: null,
    });

    renderPage(['/search?q=twerking&filter=videos&sort=top']);

    fireEvent.click(screen.getAllByTestId('video-card-video-2')[0]!);

    expect(mockNavigate).toHaveBeenCalledWith('/video/video-2?source=search&q=twerking&sort=top&index=1');
  });

  it('renders a play-all button for video search results and navigates with source context', async () => {
    const user = userEvent.setup();
    mockUseInfiniteSearchVideos.mockReturnValue({
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
    });

    renderPage(['/search?q=twerking&filter=videos']);

    const button = await screen.findByRole('button', { name: /play all/i });
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/search?q=twerking&filter=videos&play=compilation&start=0');
  });

  it('uses the live search state for returnTo even before the debounced url sync runs', async () => {
    const user = userEvent.setup();
    mockUseInfiniteSearchVideos.mockReturnValue({
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
    });

    renderPage(['/search?q=vine&filter=videos']);

    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'twerking');
    await user.click(await screen.findByRole('button', { name: /play all/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/search?q=twerking&filter=videos&play=compilation&start=0');
  });

  it('auto-opens the existing fullscreen feed when compilation mode is present in the search url', () => {
    mockUseInfiniteSearchVideos.mockReturnValue({
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
    });

    renderPage(['/search?q=twerking&filter=videos&play=compilation&start=0']);

    expect(mockEnterFullscreen).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'video-1' })],
      0,
    );
  });

  it('preserves compilation params during the debounced search url sync', async () => {
    vi.useFakeTimers();
    mockUseInfiniteSearchVideos.mockReturnValue({
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
    });

    renderPage(['/search?q=twerking&filter=videos&play=compilation&video=video-1']);

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByTestId('location-display').textContent).toBe(
      '/search?q=twerking&filter=videos&play=compilation&video=video-1'
    );
  });

  // Regression: bare VideoCard hides view counts because it has no metrics
  // wrapper. Search results MUST go through VideoCardWithMetrics so loop /
  // view counts render alongside other feeds.
  it('renders the All-tab video grid via VideoCardWithMetrics, not bare VideoCard', () => {
    mockUseInfiniteSearchVideos.mockReturnValue({
      data: { pages: [{ videos: [{ id: 'video-1', pubkey: 'a'.repeat(64) }] }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isLoading: false,
      error: null,
    });

    renderPage(['/search?q=dance']);

    expect(screen.getAllByTestId('video-card-video-1').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('bare-video-card-video-1')).toHaveLength(0);
  });

  it('renders the videos-only tab grid via VideoCardWithMetrics, not bare VideoCard', () => {
    mockUseInfiniteSearchVideos.mockReturnValue({
      data: { pages: [{ videos: [{ id: 'video-2', pubkey: 'b'.repeat(64) }] }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isLoading: false,
      error: null,
    });

    renderPage(['/search?q=dance&filter=videos']);

    expect(screen.getAllByTestId('video-card-video-2').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('bare-video-card-video-2')).toHaveLength(0);
  });
});
