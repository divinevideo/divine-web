// ABOUTME: Tests for PeopleListEditMode — owner curate screen (Figma #8)
// ABOUTME: Covers title/members, user search, add button, and already-in-list suppression

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PeopleListEditMode } from './PeopleListEditMode';

// ---- mock react-router-dom navigate ----------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ---- mock PeopleListMembersGrid ---------------------------------------------

vi.mock('@/components/PeopleListMembersGrid', () => ({
  PeopleListMembersGrid: ({ pubkey, dTag }: { pubkey: string; dTag: string }) => (
    <div data-testid="members-grid" data-pubkey={pubkey} data-dtag={dTag} />
  ),
}));

// ---- mock usePeopleList -----------------------------------------------------

vi.mock('@/hooks/usePeopleList');
import { usePeopleList } from '@/hooks/usePeopleList';
const mockUsePeopleList = vi.mocked(usePeopleList);

// ---- mock useAddToPeopleList -------------------------------------------------

vi.mock('@/hooks/usePeopleListMutations');
import { useAddToPeopleList } from '@/hooks/usePeopleListMutations';
const mockUseAddToPeopleList = vi.mocked(useAddToPeopleList);

// ---- mock useSearchUsers ----------------------------------------------------

vi.mock('@/hooks/useSearchUsers');
import { useSearchUsers } from '@/hooks/useSearchUsers';
const mockUseSearchUsers = vi.mocked(useSearchUsers);

// ---- shared fixtures --------------------------------------------------------

const OWNER_PUBKEY = 'a'.repeat(64);
const D_TAG = 'my-list';

// A member already in the list
const MEMBER_PUBKEY = 'b'.repeat(64);
// A candidate not in the list
const CANDIDATE_PUBKEY = 'c'.repeat(64);

function makeMutationReturn(mutateAsync = vi.fn().mockResolvedValue(undefined)) {
  return {
    mutateAsync,
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    isIdle: true,
    error: null,
    data: undefined,
    variables: undefined,
    reset: vi.fn(),
    status: 'idle' as const,
    context: undefined,
    failureCount: 0,
    failureReason: null,
    submittedAt: 0,
  } as unknown as ReturnType<typeof useAddToPeopleList>;
}

function renderScreen(props: { pubkey?: string; dTag?: string } = {}) {
  return render(
    <MemoryRouter>
      <PeopleListEditMode
        pubkey={props.pubkey ?? OWNER_PUBKEY}
        dTag={props.dTag ?? D_TAG}
      />
    </MemoryRouter>,
  );
}

// ---- tests ------------------------------------------------------------------

describe('PeopleListEditMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: list with one member
    mockUsePeopleList.mockReturnValue({
      data: {
        id: D_TAG,
        pubkey: OWNER_PUBKEY,
        name: 'My Cool List',
        members: [MEMBER_PUBKEY],
        createdAt: 1_700_000_000,
      },
      isLoading: false,
      isError: false,
      isPending: false,
      isSuccess: true,
      status: 'success',
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isInitialLoading: false,
      isLoadingError: false,
      isPlaceholderData: false,
      isPreviousData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
      refetch: vi.fn(),
      fetchStatus: 'idle',
      isRefetchingError: false,
    } as unknown as ReturnType<typeof usePeopleList>);

    mockUseAddToPeopleList.mockReturnValue(makeMutationReturn());

    // Default: empty search results (no query yet)
    mockUseSearchUsers.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      isFetching: false,
      isPending: false,
      isSuccess: true,
      status: 'success',
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isFetched: true,
      isFetchedAfterMount: true,
      isInitialLoading: false,
      isLoadingError: false,
      isPlaceholderData: false,
      isPreviousData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
      refetch: vi.fn(),
      fetchStatus: 'idle',
      isRefetchingError: false,
    } as unknown as ReturnType<typeof useSearchUsers>);
  });

  // Test 1: renders title and members grid
  it('renders the list title and members grid', () => {
    renderScreen();

    // The list name should appear as the page heading
    expect(screen.getByText('My Cool List')).toBeInTheDocument();

    // The members grid should be rendered with correct props
    const grid = screen.getByTestId('members-grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveAttribute('data-pubkey', OWNER_PUBKEY);
    expect(grid).toHaveAttribute('data-dtag', D_TAG);
  });

  // Test 2: typing in search input triggers user search
  it('triggers user search when typing in the search input', () => {
    renderScreen();

    const searchInput = screen.getByPlaceholderText(/search for someone/i);
    fireEvent.change(searchInput, { target: { value: 'alice' } });

    // useSearchUsers should have been called with the new query value
    expect(mockUseSearchUsers).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'alice' }),
    );
  });

  // Test 3: search result row renders avatar + name + Add button
  it('renders a search result row with name and Add button', async () => {
    // Set up results before render
    mockUseSearchUsers.mockReturnValue({
      data: [
        {
          pubkey: CANDIDATE_PUBKEY,
          metadata: {
            name: 'alice',
            display_name: 'Alice Candidate',
            picture: 'https://example.com/pic.jpg',
          },
        },
      ],
      isLoading: false,
      isError: false,
      isFetching: false,
      isPending: false,
      isSuccess: true,
      status: 'success',
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isFetched: true,
      isFetchedAfterMount: true,
      isInitialLoading: false,
      isLoadingError: false,
      isPlaceholderData: false,
      isPreviousData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
      refetch: vi.fn(),
      fetchStatus: 'idle',
      isRefetchingError: false,
    } as unknown as ReturnType<typeof useSearchUsers>);

    renderScreen();

    // Type in the search input to trigger results display
    const searchInput = screen.getByPlaceholderText(/search for someone/i);
    fireEvent.change(searchInput, { target: { value: 'alice' } });

    // Name should appear
    await waitFor(() => {
      expect(screen.getByText('Alice Candidate')).toBeInTheDocument();
    });

    // Add button should appear
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  // Test 4: clicking Add calls mutateAsync
  it('clicking Add button calls useAddToPeopleList.mutateAsync with correct args', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseAddToPeopleList.mockReturnValue(makeMutationReturn(mutateAsync));

    mockUseSearchUsers.mockReturnValue({
      data: [
        {
          pubkey: CANDIDATE_PUBKEY,
          metadata: {
            name: 'alice',
            display_name: 'Alice Candidate',
          },
        },
      ],
      isLoading: false,
      isError: false,
      isFetching: false,
      isPending: false,
      isSuccess: true,
      status: 'success',
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isFetched: true,
      isFetchedAfterMount: true,
      isInitialLoading: false,
      isLoadingError: false,
      isPlaceholderData: false,
      isPreviousData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
      refetch: vi.fn(),
      fetchStatus: 'idle',
      isRefetchingError: false,
    } as unknown as ReturnType<typeof useSearchUsers>);

    renderScreen();

    // Type in the search input to reveal results
    const searchInput = screen.getByPlaceholderText(/search for someone/i);
    fireEvent.change(searchInput, { target: { value: 'alice' } });

    await waitFor(() => {
      expect(screen.getByText('Alice Candidate')).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /add/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        listId: D_TAG,
        memberPubkey: CANDIDATE_PUBKEY,
      });
    });
  });

  // Test 5: already-in-list user shows no Add button
  it('hides Add button for a user already in the list', async () => {
    // MEMBER_PUBKEY is already in the list (members: [MEMBER_PUBKEY] from beforeEach)
    mockUseSearchUsers.mockReturnValue({
      data: [
        {
          pubkey: MEMBER_PUBKEY, // already a member!
          metadata: {
            name: 'bob',
            display_name: 'Bob Already Member',
          },
        },
      ],
      isLoading: false,
      isError: false,
      isFetching: false,
      isPending: false,
      isSuccess: true,
      status: 'success',
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isFetched: true,
      isFetchedAfterMount: true,
      isInitialLoading: false,
      isLoadingError: false,
      isPlaceholderData: false,
      isPreviousData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
      refetch: vi.fn(),
      fetchStatus: 'idle',
      isRefetchingError: false,
    } as unknown as ReturnType<typeof useSearchUsers>);

    renderScreen();

    // Type in the search input to reveal results
    const searchInput = screen.getByPlaceholderText(/search for someone/i);
    fireEvent.change(searchInput, { target: { value: 'bob' } });

    await waitFor(() => {
      expect(screen.getByText('Bob Already Member')).toBeInTheDocument();
    });

    // No Add button should appear for an already-in-list user
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument();
  });
});
