// ABOUTME: Tests for ListEditPage — owner-guard redirect, non-owner redirect, owner renders edit mode

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ---- hoisted mocks -------------------------------------------------------

const { mockNavigate, mockUseCurrentUser } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseCurrentUser: vi.fn(),
}));

// ---- module mocks --------------------------------------------------------

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock('@/components/PeopleListEditMode', () => ({
  PeopleListEditMode: ({ pubkey, dTag }: { pubkey: string; dTag: string }) => (
    <div
      data-testid="people-list-edit-mode"
      data-pubkey={pubkey}
      data-dtag={dTag}
    >
      PeopleListEditMode
    </div>
  ),
}));

// ---- import SUT after mocks ----------------------------------------------

import ListEditPage from './ListEditPage';

// ---- helpers -------------------------------------------------------------

const PUBKEY = 'a'.repeat(64);
const D_TAG = 'my-cool-list';
const ENCODED_D_TAG = encodeURIComponent(D_TAG);

const OTHER_PUBKEY = 'b'.repeat(64);

function renderPage(pubkey = PUBKEY, listId = ENCODED_D_TAG) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/list/${pubkey}/${listId}/edit`]}>
        <Routes>
          <Route path="/list/:pubkey/:listId/edit" element={<ListEditPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---- tests ---------------------------------------------------------------

describe('ListEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects non-owner (different pubkey) to detail page', () => {
    mockUseCurrentUser.mockReturnValue({ user: { pubkey: OTHER_PUBKEY } });

    renderPage();

    expect(mockNavigate).toHaveBeenCalledWith(
      `/list/${PUBKEY}/${ENCODED_D_TAG}`,
      { replace: true },
    );
    expect(screen.queryByTestId('people-list-edit-mode')).not.toBeInTheDocument();
  });

  it('redirects logged-out user (no user) to detail page', () => {
    mockUseCurrentUser.mockReturnValue({ user: null });

    renderPage();

    expect(mockNavigate).toHaveBeenCalledWith(
      `/list/${PUBKEY}/${ENCODED_D_TAG}`,
      { replace: true },
    );
    expect(screen.queryByTestId('people-list-edit-mode')).not.toBeInTheDocument();
  });

  it('renders PeopleListEditMode for the owner', () => {
    mockUseCurrentUser.mockReturnValue({ user: { pubkey: PUBKEY } });

    renderPage();

    expect(mockNavigate).not.toHaveBeenCalled();
    const editMode = screen.getByTestId('people-list-edit-mode');
    expect(editMode).toBeInTheDocument();
    expect(editMode).toHaveAttribute('data-pubkey', PUBKEY);
    expect(editMode).toHaveAttribute('data-dtag', D_TAG);
  });
});
