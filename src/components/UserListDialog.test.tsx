import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UserListDialog } from './UserListDialog';

const {
  mockNavigate,
  mockStartInactiveSpan,
  mockUseBatchedAuthors,
  mockUseCurrentUser,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseBatchedAuthors: vi.fn(),
  mockUseCurrentUser: vi.fn(),
  mockStartInactiveSpan: vi.fn(() => ({
    end: vi.fn(),
    setAttribute: vi.fn(),
  })),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useBatchedAuthors', () => ({
  useBatchedAuthors: mockUseBatchedAuthors,
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock('@/lib/genUserName', () => ({
  genUserName: (pubkey: string) => `Generated ${pubkey.slice(0, 6)}`,
}));

vi.mock('@/lib/sentry', () => ({
  Sentry: {
    startInactiveSpan: mockStartInactiveSpan,
  },
}));

vi.mock('@/components/AddToPeopleListDialog', () => ({
  AddToPeopleListDialog: ({ open, memberPubkey }: { open: boolean; memberPubkey: string }) =>
    open ? <div data-testid={`mock-add-dialog-${memberPubkey}`} /> : null,
}));

describe('UserListDialog', () => {
  beforeEach(() => {
    mockUseCurrentUser.mockReturnValue({ user: { pubkey: 'z'.repeat(64) } });
    mockUseBatchedAuthors.mockReturnValue({ data: {} });
  });

  it('renders visible fallback rows before author metadata resolves', async () => {
    render(
      <UserListDialog
        open
        onOpenChange={vi.fn()}
        title="Followers"
        pubkeys={['a'.repeat(64), 'b'.repeat(64)]}
      />,
    );

    expect(await screen.findByText('Generated aaaaaa')).toBeVisible();
    expect(screen.getByText('Generated bbbbbb')).toBeVisible();
    expect(screen.getAllByText('GE')).toHaveLength(2);
  });

  it('shows Add-to-list overflow button on each row when logged in', async () => {
    render(
      <UserListDialog
        open
        onOpenChange={vi.fn()}
        title="Followers"
        pubkeys={['a'.repeat(64), 'b'.repeat(64)]}
      />,
    );

    expect(await screen.findByTestId(`add-to-list-${'a'.repeat(64)}`)).toBeVisible();
    expect(screen.getByTestId(`add-to-list-${'b'.repeat(64)}`)).toBeVisible();
  });

  it('hides Add-to-list overflow when row pubkey matches current user', async () => {
    const me = 'z'.repeat(64);
    render(
      <UserListDialog
        open
        onOpenChange={vi.fn()}
        title="Followers"
        pubkeys={[me, 'b'.repeat(64)]}
      />,
    );

    await screen.findByText('Generated zzzzzz');
    expect(screen.queryByTestId(`add-to-list-${me}`)).toBeNull();
    expect(screen.getByTestId(`add-to-list-${'b'.repeat(64)}`)).toBeVisible();
  });

  it('clicking overflow opens AddToPeopleListDialog with the row pubkey', async () => {
    const target = 'a'.repeat(64);
    render(
      <UserListDialog
        open
        onOpenChange={vi.fn()}
        title="Followers"
        pubkeys={[target]}
      />,
    );

    const button = await screen.findByTestId(`add-to-list-${target}`);
    await userEvent.click(button);
    expect(screen.getByTestId(`mock-add-dialog-${target}`)).toBeVisible();
  });
});
