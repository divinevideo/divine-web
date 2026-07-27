import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { nip19 } from 'nostr-tools';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserListDialog } from './UserListDialog';

const {
  mockNavigate,
  mockStartInactiveSpan,
  mockUseBatchedAuthors,
  mockUseNip05Validation,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseBatchedAuthors: vi.fn(),
  mockUseNip05Validation: vi.fn(),
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

vi.mock('@/hooks/useNip05Validation', () => ({
  useNip05Validation: mockUseNip05Validation,
}));

vi.mock('@/lib/genUserName', () => ({
  genUserName: (pubkey: string) => `Generated ${pubkey.slice(0, 6)}`,
}));

vi.mock('@/lib/sentry', () => ({
  Sentry: {
    startInactiveSpan: mockStartInactiveSpan,
  },
}));

describe('UserListDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNip05Validation.mockReturnValue({
      isValid: false,
      isLoading: false,
      isInvalid: false,
      state: 'idle',
      nip05: undefined,
    });
  });

  it('renders visible fallback rows before author metadata resolves', async () => {
    mockUseBatchedAuthors.mockReturnValue({ data: {} });

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

  it('uses a friendly profile path only after NIP-05 validation succeeds', async () => {
    const user = userEvent.setup();
    const pubkey = 'a'.repeat(64);
    mockUseBatchedAuthors.mockReturnValue({
      data: {
        [pubkey]: {
          metadata: {
            display_name: 'Sam',
            nip05: '_@sam.divine.video',
          },
        },
      },
    });
    mockUseNip05Validation.mockReturnValue({
      isValid: true,
      isLoading: false,
      isInvalid: false,
      state: 'valid',
      nip05: '_@sam.divine.video',
    });

    render(
      <UserListDialog
        open
        onOpenChange={vi.fn()}
        title="Followers"
        pubkeys={[pubkey]}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /sam/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/u/sam', { ownerPubkey: pubkey });
  });

  it('uses the npub profile path when NIP-05 validation fails', async () => {
    const user = userEvent.setup();
    const pubkey = 'b'.repeat(64);
    mockUseBatchedAuthors.mockReturnValue({
      data: {
        [pubkey]: {
          metadata: {
            display_name: 'Sam',
            nip05: 'sam@spoofed.example',
          },
        },
      },
    });
    mockUseNip05Validation.mockReturnValue({
      isValid: false,
      isLoading: false,
      isInvalid: true,
      state: 'invalid',
      nip05: 'sam@spoofed.example',
    });

    render(
      <UserListDialog
        open
        onOpenChange={vi.fn()}
        title="Followers"
        pubkeys={[pubkey]}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /sam/i }));

    expect(mockNavigate).toHaveBeenCalledWith(`/profile/${nip19.npubEncode(pubkey)}`, { ownerPubkey: pubkey });
  });
});
