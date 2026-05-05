// ABOUTME: Tests for CreatePeopleListDialog component
// ABOUTME: Covers validation, successful submit, close-on-success, and prefilled-members display

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatePeopleListDialog } from './CreatePeopleListDialog';

const { mockMutateAsync, mockUseToast } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockUseToast: vi.fn(),
}));

vi.mock('@/hooks/useCreatePeopleList', () => ({
  useCreatePeopleList: () => ({
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

beforeEach(() => {
  vi.clearAllMocks();
  mockUseToast.mockReturnValue({ toast: mockToast });
  mockMutateAsync.mockResolvedValue({ id: 'test-id', name: 'My List' });
});

describe('CreatePeopleListDialog', () => {
  it('shows a validation error when submitted with an empty name', async () => {
    const user = userEvent.setup();
    render(
      <CreatePeopleListDialog
        open
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /create list/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Name is required.',
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('calls mutateAsync with the correct payload on successful submit', async () => {
    const user = userEvent.setup();
    const prefilledMembers = ['pubkey1', 'pubkey2'];

    render(
      <CreatePeopleListDialog
        open
        onOpenChange={vi.fn()}
        prefilledMembers={prefilledMembers}
      />,
    );

    await user.type(screen.getByLabelText(/list name/i), 'Cool Loopers');
    await user.type(screen.getByLabelText(/description/i), 'My picks');
    await user.click(screen.getByRole('button', { name: /create list/i }));

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: 'Cool Loopers',
        description: 'My picks',
        image: undefined,
        members: prefilledMembers,
      }),
    );
  });

  it('calls onOpenChange(false) after a successful submit', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <CreatePeopleListDialog open onOpenChange={onOpenChange} />,
    );

    await user.type(screen.getByLabelText(/list name/i), 'Test List');
    await user.click(screen.getByRole('button', { name: /create list/i }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('renders the prefilled-members count when prefilledMembers is provided', () => {
    render(
      <CreatePeopleListDialog
        open
        onOpenChange={vi.fn()}
        prefilledMembers={['pubkey-abc']}
      />,
    );

    expect(screen.getByText(/will include 1 person/i)).toBeInTheDocument();
  });
});
