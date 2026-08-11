// ABOUTME: Tests public people-list detail with people context and a video-primary feed

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import PeopleListDetailPage from './PeopleListDetailPage';

const OWNER = 'a'.repeat(64);
const ALICE = 'b'.repeat(64);
const BOB = 'c'.repeat(64);
const mockUsePeopleList = vi.fn();
const mockUsePeopleListVideos = vi.fn();
const mockShare = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockDeletePeopleList = vi.fn();
const mockToast = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'peopleListDetailPage.editList': 'Edit',
        'peopleListDetailPage.delete': 'Delete',
        'peopleListDetailPage.share': 'Share',
        'peopleListDetailPage.deletedTitle': 'People list deleted.',
        'peopleListDetailPage.deletedDescription': `"${values?.name}" has been removed.`,
        'peopleListDetailPage.deleteFailedTitle': 'Delete failed.',
        'peopleListDetailPage.deleteFailedDescription': 'People list deletion hit a snag. Try again?',
      };
      return translations[key] ?? key;
    },
  }),
}));
vi.mock('@/hooks/usePeopleLists', () => ({
  usePeopleList: (...args: unknown[]) => mockUsePeopleList(...args),
}));
vi.mock('@/hooks/usePeopleListVideos', () => ({
  usePeopleListVideos: (...args: unknown[]) => mockUsePeopleListVideos(...args),
}));
vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: {
      metadata: {
        name: 'Liz',
        picture: 'https://cdn.example.com/liz.jpg',
      },
    },
  }),
}));
vi.mock('@/hooks/useShare', () => ({
  useShare: () => ({
    share: mockShare,
  }),
}));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));
vi.mock('@/hooks/usePeopleListMutations', () => ({
  useDeletePeopleList: () => ({
    mutateAsync: mockDeletePeopleList,
    isPending: false,
  }),
}));
vi.mock('@/components/EditPeopleListDialog', () => ({
  EditPeopleListDialog: ({ list }: { list: { name: string } }) => (
    <div role="dialog" aria-label="Edit people list">
      Editing {list.name}
    </div>
  ),
}));
vi.mock('@/components/DeleteListDialog', () => ({
  DeleteListDialog: ({
    listName,
    onConfirm,
  }: {
    listName: string;
    onConfirm: () => void;
  }) => (
    <div role="dialog" aria-label="Delete people list">
      Delete {listName}
      <button type="button" onClick={onConfirm}>Confirm delete</button>
    </div>
  ),
}));
vi.mock('@/lib/subdomainLinks', () => ({
  getApexShareUrl: (path: string) => `https://divine.video${path}`,
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
    <MemoryRouter initialEntries={[`/people-lists/${OWNER}/friends`]}>
      <Routes>
        <Route path="/people-lists/:pubkey/:listId" element={<PeopleListDetailPage />} />
        <Route path="/profile/:npub/lists" element={<div>Profile lists</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PeopleListDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCurrentUser.mockReturnValue({ user: null });
    mockDeletePeopleList.mockResolvedValue(undefined);
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
    expect(screen.getByRole('link', { name: /Liz List creator/ })).toHaveAttribute(
      'href',
      `/profile/${nip19.npubEncode(OWNER)}`,
    );
    expect(screen.getAllByText('2 people')).toHaveLength(2);
    expect(screen.getByText('1 loop loaded')).toBeInTheDocument();
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

  it('shares the people-list route', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Share' }));

    expect(mockShare).toHaveBeenCalledWith({
      url: 'https://divine.video/people-lists/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/friends',
    });
  });

  it('shows owner controls only for the list owner', () => {
    mockUseCurrentUser.mockReturnValue({ user: { pubkey: OWNER } });
    renderPage();

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('hides owner controls for non-owners', () => {
    mockUseCurrentUser.mockReturnValue({ user: { pubkey: BOB } });
    renderPage();

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('deletes the people list through the owner control', async () => {
    mockUseCurrentUser.mockReturnValue({ user: { pubkey: OWNER } });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => {
      expect(mockDeletePeopleList).toHaveBeenCalledWith({
        ownerPubkey: OWNER,
        listId: 'friends',
      });
    });
  });

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
