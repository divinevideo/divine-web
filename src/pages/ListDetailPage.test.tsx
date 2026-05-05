// ABOUTME: Tests for ListDetailPage — kind dispatch between VideoListContent (30005) and PeopleListContent (30000)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ---- hoisted mocks ----------------------------------------------------------------

const { mockNostrQuery } = vi.hoisted(() => ({
  mockNostrQuery: vi.fn(),
}));

// ---- module mocks -----------------------------------------------------------------

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: { query: mockNostrQuery } }),
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: {
      relayUrl: 'wss://relay.divine.video',
      relayUrls: ['wss://relay.divine.video'],
    },
  }),
}));

const mockCurrentUser = vi.fn(() => ({ user: null as { pubkey: string } | null }));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUser(),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({ data: { metadata: { name: 'Test User', picture: undefined } } }),
}));

vi.mock('@/hooks/useVideoLists', () => ({
  useDeleteVideoList: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useShare', () => ({
  useShare: () => ({ share: vi.fn() }),
}));

vi.mock('@/hooks/useSavedLists', () => ({
  useSavedLists: () => ({ data: [] }),
}));

vi.mock('@/hooks/useSavedListsMutations', () => ({
  useSaveList: () => ({ mutate: vi.fn() }),
  useUnsaveList: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/hooks/usePeopleListStats', () => ({
  usePeopleListStats: () => ({ data: { members: 5, videos: 10, loops: null }, isSuccess: true }),
}));

vi.mock('@/config/relays', () => ({
  getEventLookupRelayUrls: () => ['wss://relay.divine.video'],
}));

// ---- component mocks (keep lightweight) ------------------------------------------

vi.mock('@/components/VideoListContent', () => ({
  VideoListContent: () => <div data-testid="video-list-content">VideoListContent</div>,
}));

vi.mock('@/components/PeopleListContent', () => ({
  PeopleListContent: ({ pubkey, dTag, isOwner }: { pubkey: string; dTag: string; isOwner?: boolean }) => (
    <div
      data-testid="people-list-content"
      data-pubkey={pubkey}
      data-dtag={dTag}
      data-is-owner={String(isOwner)}
    >
      PeopleListContent
    </div>
  ),
}));

vi.mock('@/components/EditListDialog', () => ({
  EditListDialog: () => <div data-testid="edit-list-dialog" />,
}));

vi.mock('@/components/DeleteListDialog', () => ({
  DeleteListDialog: () => <div data-testid="delete-list-dialog" />,
}));

// ---- import SUT after mocks -------------------------------------------------------

import ListDetailPage from './ListDetailPage';

// ---- helpers -----------------------------------------------------------------------

const PUBKEY = 'a'.repeat(64);
const D_TAG = 'my-list';

function makeEvent(kind: number, extraTags: string[][] = []) {
  return {
    id: 'e'.repeat(64),
    pubkey: PUBKEY,
    kind,
    created_at: 1_700_000_000,
    content: '',
    sig: 's'.repeat(128),
    tags: [['d', D_TAG], ['title', 'Test List'], ...extraTags],
  };
}

function renderPage(pubkey = PUBKEY, dTag = D_TAG) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/list/${pubkey}/${dTag}`]}>
        <Routes>
          <Route path="/list/:pubkey/:listId" element={<ListDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---- tests -------------------------------------------------------------------------

describe('ListDetailPage kind dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders PeopleListContent when the relay returns a kind-30000 event', async () => {
    mockNostrQuery.mockResolvedValue([makeEvent(30000)]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('people-list-content')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('video-list-content')).not.toBeInTheDocument();
  });

  it('renders VideoListContent when the relay returns a kind-30005 event', async () => {
    mockNostrQuery.mockResolvedValue([
      makeEvent(30005, [['a', '34236:' + 'b'.repeat(64) + ':vid1']]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('video-list-content')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('people-list-content')).not.toBeInTheDocument();
  });

  it('passes isOwner=true to PeopleListContent when the current user owns the list', async () => {
    // Temporarily override useCurrentUser so user.pubkey === list pubkey
    mockCurrentUser.mockReturnValue({ user: { pubkey: PUBKEY } });

    mockNostrQuery.mockResolvedValue([makeEvent(30000)]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('people-list-content')).toBeInTheDocument();
    });

    // PeopleListContent mock exposes isOwner via data-is-owner attribute
    expect(screen.getByTestId('people-list-content')).toHaveAttribute('data-is-owner', 'true');
  });
});
