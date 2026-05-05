import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeletePeopleListDialog } from './DeletePeopleListDialog';
import * as hooks from '@/hooks/useDeletePeopleList';
import type { PeopleList } from '@/types/peopleList';

// Mock the hooks
vi.mock('@/hooks/useDeletePeopleList');
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockList: PeopleList = {
  id: 'test-list-1',
  pubkey: 'test-pubkey',
  name: 'My Test List',
  members: ['member1', 'member2'],
  createdAt: 1000000,
};

describe('DeletePeopleListDialog', () => {
  it('confirms delete calls useDeletePeopleList.mutateAsync with listId', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({ success: true });
    const mockOnDeleted = vi.fn();
    const mockOnOpenChange = vi.fn();

    vi.mocked(hooks.useDeletePeopleList).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
      status: 'idle',
      data: undefined,
      reset: vi.fn(),
      mutate: vi.fn(),
    } as any);

    const user = userEvent.setup();

    render(
      <DeletePeopleListDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        list={mockList}
        onDeleted={mockOnDeleted}
      />,
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete List' });
    await user.click(deleteButton);

    expect(mockMutateAsync).toHaveBeenCalledWith({ listId: mockList.id });
  });

  it('cancel button calls onOpenChange(false) without deleting', async () => {
    const mockMutateAsync = vi.fn();
    const mockOnOpenChange = vi.fn();

    vi.mocked(hooks.useDeletePeopleList).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
      status: 'idle',
      data: undefined,
      reset: vi.fn(),
      mutate: vi.fn(),
    } as any);

    const user = userEvent.setup();

    render(
      <DeletePeopleListDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        list={mockList}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('successful delete calls onDeleted callback', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({ success: true });
    const mockOnDeleted = vi.fn();
    const mockOnOpenChange = vi.fn();

    vi.mocked(hooks.useDeletePeopleList).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
      status: 'idle',
      data: undefined,
      reset: vi.fn(),
      mutate: vi.fn(),
    } as any);

    const user = userEvent.setup();

    render(
      <DeletePeopleListDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        list={mockList}
        onDeleted={mockOnDeleted}
      />,
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete List' });
    await user.click(deleteButton);

    // Wait for async mutation to complete
    await vi.waitFor(() => {
      expect(mockOnDeleted).toHaveBeenCalled();
    });
  });
});
