// ABOUTME: Tests for EditPeopleListDialog component
// ABOUTME: Covers pre-population, successful update, empty description, and close-on-success

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditPeopleListDialog } from './EditPeopleListDialog';
import type { PeopleList } from '@/types/peopleList';

const { mockMutateAsync, mockUseToast } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockUseToast: vi.fn(),
}));

vi.mock('@/hooks/useUpdatePeopleList', () => ({
  useUpdatePeopleList: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => mockUseToast(),
}));

// Minimal dialog stubs so the Dialog renders its children in tests
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

const mockToast = vi.fn();

const TEST_LIST: PeopleList = {
  id: 'list-abc',
  pubkey: 'pubkey-owner',
  name: 'My Favorites',
  description: 'Top picks',
  image: 'https://example.com/cover.jpg',
  members: ['pubkey1', 'pubkey2'],
  createdAt: 1700000000,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseToast.mockReturnValue({ toast: mockToast });
  mockMutateAsync.mockResolvedValue(undefined);
});

describe('EditPeopleListDialog', () => {
  it('pre-populates form fields from list prop on open', () => {
    render(
      <EditPeopleListDialog
        open
        onOpenChange={vi.fn()}
        list={TEST_LIST}
      />,
    );

    expect(screen.getByLabelText(/list name/i)).toHaveValue('My Favorites');
    expect(screen.getByLabelText(/description/i)).toHaveValue('Top picks');
    expect(screen.getByLabelText(/cover image url/i)).toHaveValue(
      'https://example.com/cover.jpg',
    );
  });

  it('calls mutateAsync with updated name and existing description/image on submit', async () => {
    const user = userEvent.setup();

    render(
      <EditPeopleListDialog
        open
        onOpenChange={vi.fn()}
        list={TEST_LIST}
      />,
    );

    const nameInput = screen.getByLabelText(/list name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed List');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        listId: 'list-abc',
        name: 'Renamed List',
        description: 'Top picks',
        image: 'https://example.com/cover.jpg',
      }),
    );
  });

  it('submits empty string for description when description field is cleared', async () => {
    const user = userEvent.setup();

    render(
      <EditPeopleListDialog
        open
        onOpenChange={vi.fn()}
        list={TEST_LIST}
      />,
    );

    const descriptionInput = screen.getByLabelText(/description/i);
    await user.clear(descriptionInput);

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        listId: 'list-abc',
        name: 'My Favorites',
        description: '',
        image: 'https://example.com/cover.jpg',
      }),
    );
  });

  it('calls onOpenChange(false) on success', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <EditPeopleListDialog
        open
        onOpenChange={onOpenChange}
        list={TEST_LIST}
      />,
    );

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
