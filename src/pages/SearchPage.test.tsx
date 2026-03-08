import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ImgHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';
import { nip19 } from 'nostr-tools';
import SearchPage from './SearchPage';

const { mockNavigate, mockFetchVideoById } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockFetchVideoById: vi.fn(),
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

vi.mock('@/components/VideoCard', () => ({
  VideoCard: () => <div data-testid="video-card" />,
}));

vi.mock('react-infinite-scroll-component', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: {
      relayUrl: 'wss://relay.divine.video',
    },
  }),
}));

vi.mock('@/hooks/useInfiniteSearchVideos', () => ({
  useInfiniteSearchVideos: () => ({
    data: { pages: [{ videos: [] }] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isLoading: false,
    error: null,
  }),
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

function renderPage(initialEntries: string[] = ['/search']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SearchPage />
    </MemoryRouter>
  );
}

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigates directly when the query is an npub', () => {
    const npub = nip19.npubEncode('f'.repeat(64));

    renderPage();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: npub } });

    expect(mockNavigate).toHaveBeenCalledWith(`/profile/${npub}`);
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
        'https://relay.divine.video',
        'clip-7',
        undefined,
        expect.any(AbortSignal),
      );
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/video/clip-7');
    });
  });
});
