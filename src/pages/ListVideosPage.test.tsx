// ABOUTME: Tests for ListVideosPage — header, videos grid, loading state

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

vi.mock('@/components/PeopleListVideosGrid', () => ({
  PeopleListVideosGrid: ({
    pubkey,
    dTag,
  }: {
    pubkey: string;
    dTag: string;
  }) => (
    <div
      data-testid="people-list-videos-grid"
      data-pubkey={pubkey}
      data-dtag={dTag}
    >
      PeopleListVideosGrid
    </div>
  ),
}));

// ---- import SUT after mocks ----------------------------------------------

import ListVideosPage from './ListVideosPage';

// ---- helpers -------------------------------------------------------------

const PUBKEY = 'a'.repeat(64);
const D_TAG = 'my-cool-list';

function makeList(overrides = {}) {
  return {
    id: D_TAG,
    pubkey: PUBKEY,
    name: 'My Cool List',
    members: ['b'.repeat(64)],
    createdAt: 1_700_000_000,
    ...overrides,
  };
}

function renderPage(pubkey = PUBKEY, dTag = D_TAG) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/list/${pubkey}/${dTag}/videos`]}>
        <Routes>
          <Route path="/list/:pubkey/:listId/videos" element={<ListVideosPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---- tests ---------------------------------------------------------------

describe('ListVideosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header with list name and videos grid', async () => {
    mockUsePeopleList.mockReturnValue({ data: makeList(), isLoading: false });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('My Cool List')).toBeInTheDocument();
    });
    const grid = screen.getByTestId('people-list-videos-grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveAttribute('data-pubkey', PUBKEY);
    expect(grid).toHaveAttribute('data-dtag', D_TAG);
  });

  it('shows loading skeleton when list is loading', () => {
    mockUsePeopleList.mockReturnValue({ data: undefined, isLoading: true });

    renderPage();

    // Skeleton renders but main content is not yet visible
    expect(screen.queryByTestId('people-list-videos-grid')).not.toBeInTheDocument();
    expect(screen.queryByText('My Cool List')).not.toBeInTheDocument();
  });
});
