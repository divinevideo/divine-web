// ABOUTME: Tests public people-list detail with people context and a video-primary feed

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import PeopleListDetailPage from './PeopleListDetailPage';

const OWNER = 'a'.repeat(64);
const ALICE = 'b'.repeat(64);
const BOB = 'c'.repeat(64);
const mockUsePeopleList = vi.fn();
const mockUsePeopleListVideos = vi.fn();

vi.mock('@/hooks/usePeopleLists', () => ({
  usePeopleList: (...args: unknown[]) => mockUsePeopleList(...args),
}));
vi.mock('@/hooks/usePeopleListVideos', () => ({
  usePeopleListVideos: (...args: unknown[]) => mockUsePeopleListVideos(...args),
}));
vi.mock('@/hooks/useBatchedAuthors', () => ({
  useBatchedAuthors: () => ({
    data: {
      [ALICE]: { metadata: { name: 'Alice' } },
      [BOB]: { metadata: { name: 'Bob' } },
    },
  }),
}));
vi.mock('@/components/VideoGrid', () => ({
  VideoGrid: ({ videos, navigationContext }: { videos: unknown[]; navigationContext?: unknown }) => (
    <div data-testid="video-grid" data-navigation-context={JSON.stringify(navigationContext)}>
      {videos.length} videos
    </div>
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/list/${OWNER}/friends`]}>
      <Routes>
        <Route path="/list/:pubkey/:listId" element={<PeopleListDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PeopleListDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePeopleList.mockReturnValue({
      data: {
        id: 'friends',
        name: 'Friends',
        description: 'Good people making good loops.',
        pubkey: OWNER,
        createdAt: 10,
        memberPubkeys: [ALICE, BOB],
      },
      isLoading: false,
      isError: false,
      isFetched: true,
    });
    mockUsePeopleListVideos.mockReturnValue({
      data: { pages: [{ videos: [{ id: 'video-1' }] }] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
      isFetchingNextPage: false,
    });
  });

  it('shows people before the primary videos section with full member links', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Friends' })).toBeInTheDocument();
    expect(screen.getByText('Good people making good loops.')).toBeInTheDocument();
    const peopleHeading = screen.getByRole('heading', { name: 'People' });
    const videosHeading = screen.getByRole('heading', { name: 'Videos' });
    expect(peopleHeading.compareDocumentPosition(videosHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: /Alice/ })).toHaveAttribute(
      'href',
      `/${nip19.npubEncode(ALICE)}`,
    );
    expect(screen.getByRole('link', { name: /Bob/ })).toHaveAttribute(
      'href',
      `/${nip19.npubEncode(BOB)}`,
    );
    expect(screen.getByTestId('video-grid')).toHaveTextContent('1 videos');
    expect(screen.getByTestId('video-grid')).toHaveAttribute(
      'data-navigation-context',
      JSON.stringify({ source: 'people-list', pubkey: OWNER, listId: 'friends' }),
    );
    expect(screen.queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument();
  }, 10_000);

  it('shows a not-found state when the exact list is absent', () => {
    mockUsePeopleList.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      isFetched: true,
    });
    renderPage();
    expect(screen.getByText('That people list could not be found.')).toBeInTheDocument();
  });

  it('keeps load more reachable when the loaded videos are filtered out', () => {
    const fetchNextPage = vi.fn();
    mockUsePeopleListVideos.mockReturnValue({
      data: { pages: [{ videos: [] }] },
      isLoading: false,
      isError: false,
      hasNextPage: true,
      fetchNextPage,
      refetch: vi.fn(),
      isFetchingNextPage: false,
    });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('No loops from these people yet.')).not.toBeInTheDocument();
  });
});
