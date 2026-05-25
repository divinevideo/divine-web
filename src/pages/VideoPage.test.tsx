import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { HTMLAttributes, ReactNode } from 'react';
import VideoPage from './VideoPage';
import { initializeI18n } from '@/lib/i18n';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock('@unhead/react', () => ({
  useSeoMeta: vi.fn(),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useVideoByIdFunnelcake', () => ({
  useVideoByIdFunnelcake: (options: { query?: string }) => {
    const videos = [
      {
        id: 'video-1',
        pubkey: 'a'.repeat(64),
        kind: 34236,
        createdAt: 1,
        content: 'one',
        videoUrl: 'https://example.com/1.mp4',
        hashtags: [],
        reposts: [],
      },
      {
        id: 'video-2',
        pubkey: 'b'.repeat(64),
        kind: 34236,
        createdAt: 2,
        content: 'two',
        videoUrl: 'https://example.com/2.mp4',
        hashtags: [],
        reposts: [],
      },
      {
        id: 'video-3',
        pubkey: 'c'.repeat(64),
        kind: 34236,
        createdAt: 3,
        content: 'three',
        videoUrl: 'https://example.com/3.mp4',
        hashtags: [],
        reposts: [],
      },
    ];

    if (options.query === 'twerking') {
      return {
        video: videos[1],
        videos,
        windowOffset: 0,
        isLoading: false,
        error: null,
      };
    }

    return {
      video: videos[1],
      videos: null,
      windowOffset: 0,
      isLoading: false,
      error: null,
    };
  },
}));

vi.mock('@/hooks/useVideoNavigation', () => ({
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
    mutateAsync: vi.fn(),
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
    user: null,
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
    toast: vi.fn(),
  }),
}));

vi.mock('@/components/VideoCard', () => ({
  VideoCard: ({ video }: { video: { id: string } }) => <div data-testid="video-card">{video.id}</div>,
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
});
