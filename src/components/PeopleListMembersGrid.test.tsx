// ABOUTME: Tests for PeopleListMembersGrid — vertical list of member rows for a people list
// ABOUTME: Covers rendering, sub-line logic (NIP-05 vs npub), empty/loading states, and edit-mode removal

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PeopleListMembersGrid } from './PeopleListMembersGrid';

// ---- mock AddToPeopleListDialog (avoids NostrProvider requirement) -----------

vi.mock('@/components/AddToPeopleListDialog', () => ({
  AddToPeopleListDialog: () => null,
}));

// ---- mock usePeopleListMembers -----------------------------------------------

vi.mock('@/hooks/usePeopleListMembers');
import { usePeopleListMembers } from '@/hooks/usePeopleListMembers';
const mockUsePeopleListMembers = vi.mocked(usePeopleListMembers);

// ---- mock useRemoveFromPeopleList --------------------------------------------

vi.mock('@/hooks/usePeopleListMutations');
import { useRemoveFromPeopleList } from '@/hooks/usePeopleListMutations';
const mockUseRemoveFromPeopleList = vi.mocked(useRemoveFromPeopleList);

// ---- shared fixtures ---------------------------------------------------------

const OWNER_PUBKEY = 'a'.repeat(64);
const D_TAG = 'my-people-list';

// Deterministic hex pubkeys for members
const MEMBER_PUBKEY_A = 'b'.repeat(64);
const MEMBER_PUBKEY_B = 'c'.repeat(64);

function makeMembers(overrides: Partial<{ nip05: string }>[] = [{}]) {
  return overrides.map((o, i) => ({
    pubkey: i === 0 ? MEMBER_PUBKEY_A : MEMBER_PUBKEY_B,
    metadata: {
      name: `user${i}`,
      display_name: `Display User ${i}`,
      ...o,
    },
  }));
}

function renderGrid(props: Partial<React.ComponentProps<typeof PeopleListMembersGrid>> = {}) {
  const defaults = {
    pubkey: OWNER_PUBKEY,
    dTag: D_TAG,
    isOwner: false,
    editMode: false,
  };
  return render(
    <MemoryRouter>
      <PeopleListMembersGrid {...defaults} {...props} />
    </MemoryRouter>,
  );
}

// ---- tests -------------------------------------------------------------------

describe('PeopleListMembersGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: remove mutation stub
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseRemoveFromPeopleList.mockReturnValue({
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
      status: 'idle',
      context: undefined,
      failureCount: 0,
      failureReason: null,
      submittedAt: 0,
    } as ReturnType<typeof useRemoveFromPeopleList>);
  });

  it('renders one row per member with display_name shown', () => {
    mockUsePeopleListMembers.mockReturnValue({
      members: makeMembers([{ display_name: 'Alice One' }, { display_name: 'Bob Two' }]),
      isLoading: false,
      isError: false,
    });

    renderGrid();

    expect(screen.getByText('Alice One')).toBeInTheDocument();
    expect(screen.getByText('Bob Two')).toBeInTheDocument();
  });

  it('sub-line shows NIP-05 when metadata.nip05 is present', () => {
    mockUsePeopleListMembers.mockReturnValue({
      members: makeMembers([{ nip05: 'alice@example.com' }]),
      isLoading: false,
      isError: false,
    });

    renderGrid();

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('sub-line shows truncated npub when no NIP-05', () => {
    mockUsePeopleListMembers.mockReturnValue({
      members: makeMembers([{}]),
      isLoading: false,
      isError: false,
    });

    renderGrid();

    // The sub-line should start with "npub1" and end with "…" followed by chars
    const subLines = screen.getAllByText(/^npub1/);
    expect(subLines.length).toBeGreaterThan(0);
    // Truncated form: contains ellipsis
    expect(subLines[0].textContent).toMatch(/…/);
  });

  it('shows empty state when list has 0 members', () => {
    mockUsePeopleListMembers.mockReturnValue({
      members: [],
      isLoading: false,
      isError: false,
    });

    renderGrid();

    expect(screen.getByText(/nobody on this list yet/i)).toBeInTheDocument();
  });

  it('editMode + isOwner: clicking minus button calls useRemoveFromPeopleList.mutateAsync', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseRemoveFromPeopleList.mockReturnValue({
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
      status: 'idle',
      context: undefined,
      failureCount: 0,
      failureReason: null,
      submittedAt: 0,
    } as ReturnType<typeof useRemoveFromPeopleList>);

    mockUsePeopleListMembers.mockReturnValue({
      members: makeMembers([{}]),
      isLoading: false,
      isError: false,
    });

    renderGrid({ isOwner: true, editMode: true });

    const removeBtn = screen.getByRole('button', { name: /remove member/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        listId: D_TAG,
        memberPubkey: MEMBER_PUBKEY_A,
      });
    });
  });
});
