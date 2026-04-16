import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WatchPage } from './WatchPage';

const { mockNavigate, mockUseCompilationSource } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseCompilationSource: vi.fn(),
}));

vi.mock('@unhead/react', () => ({
  useSeoMeta: vi.fn(),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useCompilationSource', () => ({
  useCompilationSource: mockUseCompilationSource,
}));

vi.mock('@/components/CompilationPlayerSurface', () => ({
  CompilationPlayerSurface: ({
    videos,
    onVideoChange,
  }: {
    videos: Array<{ id: string; title?: string; authorName?: string; content?: string }>;
    onVideoChange?: (video: { id: string; title?: string; authorName?: string; content?: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onVideoChange?.(videos[1])}
    >
      advance
    </button>
  ),
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

function renderPage(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/watch" element={<WatchPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('WatchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCompilationSource.mockReturnValue({
      kind: 'search',
      videos: [
        {
          id: 'video-a',
          pubkey: 'a'.repeat(64),
          videoUrl: 'https://example.com/a.mp4',
          title: 'Video A',
          authorName: 'Author A',
          content: 'About A',
        },
        {
          id: 'video-b',
          pubkey: 'b'.repeat(64),
          videoUrl: 'https://example.com/b.mp4',
          title: 'Video B',
          authorName: 'Author B',
          content: 'About B',
        },
      ],
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isLoading: false,
      error: null,
    });
  });

  it('renders compilation metadata for a search-backed source', async () => {
    renderPage('/watch?play=compilation&source=search&q=twerking&filter=videos&start=0');

    expect(await screen.findByText('Search: "twerking"')).toBeInTheDocument();
    expect(screen.getByTestId('compilation-player')).toBeInTheDocument();
  });

  it('navigates back to returnTo when the back button is pressed', async () => {
    const user = userEvent.setup();
    renderPage('/watch?play=compilation&source=classics&returnTo=%2Fsearch%3Fq%3Dvine');

    await user.click(await screen.findByRole('button', { name: /back/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/search?q=vine');
  });

  it('updates title, author, and about text when playback advances', async () => {
    const user = userEvent.setup();
    renderPage('/watch?play=compilation&source=search&q=twerking&filter=videos&start=0');

    await user.click(await screen.findByRole('button', { name: 'advance' }));

    expect(screen.getByText('Video B')).toBeInTheDocument();
    expect(screen.getByText('Author B')).toBeInTheDocument();
    expect(screen.getByText('About B')).toBeInTheDocument();
  });
});
