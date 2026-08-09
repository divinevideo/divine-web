import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

import ListDetailPage from './ListDetailPage';

const OWNER = 'a'.repeat(64);
const COLLABORATOR = 'b'.repeat(64);
const OUTSIDER = 'c'.repeat(64);
const { mockCurrentUser, mockQuery } = vi.hoisted(() => ({
  mockCurrentUser: vi.fn(),
  mockQuery: vi.fn(),
}));

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockQuery,
    },
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'listDetailPage.videoCount') return `${params?.count ?? 0} videos`;
      return key;
    },
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: mockCurrentUser() }),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: {
      metadata: {
        name: 'Owner',
      },
    },
  }),
}));

vi.mock('@/hooks/useVideoLists', () => ({
  useRemoveVideoFromList: () => ({ mutateAsync: vi.fn() }),
  useDeleteVideoList: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: {
      relayUrl: 'wss://relay.divine.video',
      relayUrls: ['wss://relay.divine.video'],
    },
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useShare', () => ({
  useShare: () => ({ share: vi.fn() }),
}));

vi.mock('@/components/EditListDialog', () => ({
  EditListDialog: () => <div />,
}));

vi.mock('@/components/DeleteListDialog', () => ({
  DeleteListDialog: () => <div />,
}));

function makeListEvent(): NostrEvent {
  return {
    id: 'd'.repeat(64),
    pubkey: OWNER,
    created_at: 1_700_000_000,
    kind: 30005,
    tags: [
      ['d', 'favorites'],
      ['title', 'Favorites'],
      ['collaborative', 'true'],
      ['collaborator', COLLABORATOR],
    ],
    content: '',
    sig: 'e'.repeat(128),
  };
}

function renderPage(currentUserPubkey: string) {
  mockCurrentUser.mockReturnValue({ pubkey: currentUserPubkey });
  mockQuery.mockImplementation(async (filters: Array<{ kinds?: number[]; authors?: string[] }>) => {
    if (filters[0]?.kinds?.includes(30005)) {
      return [makeListEvent()];
    }

    return [];
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/list/${OWNER}/favorites`]}>
        <Routes>
          <Route path="/list/:pubkey/:listId" element={<ListDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ListDetailPage permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets the owner edit metadata, delete the list, and edit content', async () => {
    renderPage(OWNER);

    expect(await screen.findByRole('button', { name: /listDetailPage.editList/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /listDetailPage.delete/ })).toBeInTheDocument();
    expect(await screen.findByText('listDetailPage.emptyListOwnerHint')).toBeInTheDocument();
  });

  it('lets collaborators edit content without editing metadata or deleting the list', async () => {
    renderPage(COLLABORATOR);

    expect(await screen.findByText('listDetailPage.emptyListOwnerHint')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /listDetailPage.editList/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /listDetailPage.delete/ })).not.toBeInTheDocument();
  });

  it('hides edit controls from non-collaborators', async () => {
    renderPage(OUTSIDER);

    expect(await screen.findByText('listDetailPage.emptyList')).toBeInTheDocument();
    expect(screen.queryByText('listDetailPage.emptyListOwnerHint')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /listDetailPage.editList/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /listDetailPage.delete/ })).not.toBeInTheDocument();
  });
});
