import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import { UserListDialog } from './UserListDialog';

const {
  mockNavigate,
  mockStartInactiveSpan,
  mockUseBatchedAuthors,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseBatchedAuthors: vi.fn(),
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
    mockStartInactiveSpan.mockReturnValue({
      end: vi.fn(),
      setAttribute: vi.fn(),
    });
  });

  it('navigates directly to the npub profile even when metadata has a NIP-05 alias', async () => {
    const pubkey = 'a'.repeat(64);
    mockUseBatchedAuthors.mockReturnValue({
      data: {
        [pubkey]: {
          metadata: { name: 'alice', nip05: 'alice@divine.video' },
        },
      },
    });

    render(
      <UserListDialog
        open
        onOpenChange={vi.fn()}
        title="Followers"
        pubkeys={[pubkey]}
      />,
    );

    fireEvent.click(await screen.findByText('alice'));

    expect(mockNavigate).toHaveBeenCalledWith(
      `/profile/${nip19.npubEncode(pubkey)}`,
      { ownerPubkey: pubkey },
    );
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
});
