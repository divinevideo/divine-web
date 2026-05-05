// ABOUTME: Tests for ListMembersPage — header, member count, members grid, loading state

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ---- hoisted mocks -------------------------------------------------------

const { mockUsePeopleList } = vi.hoisted(() => ({
  mockUsePeopleList: vi.fn(),
}));

// ---- module mocks --------------------------------------------------------

vi.mock('@/hooks/usePeopleList', () => ({
  usePeopleList: (...args: unknown[]) => mockUsePeopleList(...args),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null as { pubkey: string } | null }),
}));

vi.mock('@/components/PeopleListMembersGrid', () => ({
  PeopleListMembersGrid: ({
    pubkey,
    dTag,
  }: {
    pubkey: string;
    dTag: string;
  }) => (
    <div
      data-testid="people-list-members-grid"
      data-pubkey={pubkey}
      data-dtag={dTag}
    >
      PeopleListMembersGrid
    </div>
  ),
}));

// ---- import SUT after mocks ----------------------------------------------

import ListMembersPage from './ListMembersPage';

// ---- helpers -------------------------------------------------------------

const PUBKEY = 'a'.repeat(64);
const D_TAG = 'my-cool-list';

function makeList(overrides = {}) {
  return {
    id: D_TAG,
    pubkey: PUBKEY,
    name: 'My Cool List',
    members: ['b'.repeat(64), 'c'.repeat(64), 'd'.repeat(64)],
    createdAt: 1_700_000_000,
    ...overrides,
  };
}

function renderPage(pubkey = PUBKEY, dTag = D_TAG) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/list/${pubkey}/${dTag}/members`]}>
        <Routes>
          <Route path="/list/:pubkey/:listId/members" element={<ListMembersPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---- tests ---------------------------------------------------------------

describe('ListMembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header with list name and member count', async () => {
    mockUsePeopleList.mockReturnValue({ data: makeList(), isLoading: false });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('My Cool List')).toBeInTheDocument();
    });
    expect(screen.getByText('3 people')).toBeInTheDocument();
  });

  it('renders the members grid component with correct props', async () => {
    mockUsePeopleList.mockReturnValue({ data: makeList(), isLoading: false });

    renderPage();

    await waitFor(() => {
      const grid = screen.getByTestId('people-list-members-grid');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveAttribute('data-pubkey', PUBKEY);
      expect(grid).toHaveAttribute('data-dtag', D_TAG);
    });
  });

  it('shows loading skeleton when list is loading', () => {
    mockUsePeopleList.mockReturnValue({ data: undefined, isLoading: true });

    renderPage();

    // Skeleton renders divs — assert no main content is visible yet
    expect(screen.queryByTestId('people-list-members-grid')).not.toBeInTheDocument();
    expect(screen.queryByText('My Cool List')).not.toBeInTheDocument();
  });
});
