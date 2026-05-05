// ABOUTME: Tests for AddToPeopleListDialog component
// ABOUTME: Covers list rendering, pre-check logic, toggle mutations, and empty state

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddToPeopleListDialog } from './AddToPeopleListDialog';
import type { PeopleList } from '@/types/peopleList';

const MEMBER_PUBKEY = 'aaaa'.repeat(16);
const OTHER_PUBKEY = 'bbbb'.repeat(16);
const CURRENT_USER_PUBKEY = 'cccc'.repeat(16);

const LIST_A: PeopleList = {
  id: 'list-a',
  pubkey: CURRENT_USER_PUBKEY,
  name: 'Alpha List',
  members: [],
  createdAt: 1700000001,
};

const LIST_B: PeopleList = {
  id: 'list-b',
  pubkey: CURRENT_USER_PUBKEY,
  name: 'Beta List',
  members: [MEMBER_PUBKEY],
  createdAt: 1700000002,
};

const { mockAddMutateAsync, mockRemoveMutateAsync } = vi.hoisted(() => ({
  mockAddMutateAsync: vi.fn(),
  mockRemoveMutateAsync: vi.fn(),
}));

vi.mock('@/hooks/usePeopleLists', () => ({
  usePeopleLists: vi.fn(),
}));

vi.mock('@/hooks/usePeopleListMutations', () => ({
  useAddToPeopleList: () => ({
    mutateAsync: mockAddMutateAsync,
    isPending: false,
  }),
  useRemoveFromPeopleList: () => ({
    mutateAsync: mockRemoveMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: CURRENT_USER_PUBKEY },
  }),
}));

vi.mock('@/components/CreatePeopleListDialog', () => ({
  CreatePeopleListDialog: ({ open }: { open: boolean; onOpenChange: (v: boolean) => void; prefilledMembers?: string[] }) =>
    open ? <div data-testid="create-dialog">Create Dialog</div> : null,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      data-testid={`checkbox-${id}`}
    />
  ),
}));

import { usePeopleLists } from '@/hooks/usePeopleLists';
const mockUsePeopleLists = vi.mocked(usePeopleLists);

beforeEach(() => {
  vi.clearAllMocks();
  mockAddMutateAsync.mockResolvedValue(undefined);
  mockRemoveMutateAsync.mockResolvedValue(undefined);
});

describe('AddToPeopleListDialog', () => {
  it('renders one row per list with the correct names', () => {
    mockUsePeopleLists.mockReturnValue({
      data: [LIST_A, LIST_B],
      isLoading: false,
    } as ReturnType<typeof usePeopleLists>);

    render(
      <AddToPeopleListDialog
        open
        onOpenChange={vi.fn()}
        memberPubkey={OTHER_PUBKEY}
      />,
    );

    expect(screen.getByText('Alpha List')).toBeInTheDocument();
    expect(screen.getByText('Beta List')).toBeInTheDocument();
  });

  it('pre-checks rows for lists that already contain memberPubkey', () => {
    mockUsePeopleLists.mockReturnValue({
      data: [LIST_A, LIST_B],
      isLoading: false,
    } as ReturnType<typeof usePeopleLists>);

    render(
      <AddToPeopleListDialog
        open
        onOpenChange={vi.fn()}
        memberPubkey={MEMBER_PUBKEY}
      />,
    );

    // LIST_B contains MEMBER_PUBKEY — its checkbox should be checked
    expect(screen.getByTestId('checkbox-list-b')).toBeChecked();
    // LIST_A does not — its checkbox should be unchecked
    expect(screen.getByTestId('checkbox-list-a')).not.toBeChecked();
  });

  it('toggling an unchecked row calls addMutation, toggling a checked row calls removeMutation', async () => {
    const user = userEvent.setup();

    mockUsePeopleLists.mockReturnValue({
      data: [LIST_A, LIST_B],
      isLoading: false,
    } as ReturnType<typeof usePeopleLists>);

    render(
      <AddToPeopleListDialog
        open
        onOpenChange={vi.fn()}
        memberPubkey={MEMBER_PUBKEY}
      />,
    );

    // LIST_A is unchecked → checking it should call add
    await user.click(screen.getByTestId('checkbox-list-a'));
    await waitFor(() =>
      expect(mockAddMutateAsync).toHaveBeenCalledWith({
        listId: 'list-a',
        memberPubkey: MEMBER_PUBKEY,
      }),
    );

    // LIST_B is checked → unchecking it should call remove
    await user.click(screen.getByTestId('checkbox-list-b'));
    await waitFor(() =>
      expect(mockRemoveMutateAsync).toHaveBeenCalledWith({
        listId: 'list-b',
        memberPubkey: MEMBER_PUBKEY,
      }),
    );
  });

  it('shows empty state headline and create CTA when user has no lists', () => {
    mockUsePeopleLists.mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof usePeopleLists>);

    render(
      <AddToPeopleListDialog
        open
        onOpenChange={vi.fn()}
        memberPubkey={OTHER_PUBKEY}
      />,
    );

    expect(screen.getByText(/you don't have any lists yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create new list/i })).toBeInTheDocument();
    // No list rows
    expect(screen.queryByTestId(/^checkbox-/)).not.toBeInTheDocument();
  });
});
