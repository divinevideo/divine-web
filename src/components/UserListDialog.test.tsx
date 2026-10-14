import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { nip19 } from 'nostr-tools';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserListDialog } from './UserListDialog';
import { initializeI18n } from '@/lib/i18n';

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
  beforeEach(async () => {
    vi.clearAllMocks();
    await initializeI18n({ force: true, languages: ['en-US'] });
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

  it('keeps a resolved name after the batch window scrolls past it', async () => {
    // useBatchedAuthors is keyed on the visible window, so scrolling mints a new
    // query whose data covers only the new window. Without accumulation the rows
    // left behind fall back to genUserName and the default avatar — the list
    // visibly resets itself as you scroll.
    const pubkey = 'a'.repeat(64);
    mockUseBatchedAuthors.mockReturnValue({
      data: { [pubkey]: { metadata: { display_name: 'Sam' } } },
    });

    const { rerender } = render(
      <UserListDialog open onOpenChange={vi.fn()} title="Following" pubkeys={[pubkey]} />,
    );
    expect(await screen.findByText('Sam')).toBeVisible();

    // The window moved on; this pubkey is no longer in the batch response.
    mockUseBatchedAuthors.mockReturnValue({ data: {} });
    rerender(
      <UserListDialog open onOpenChange={vi.fn()} title="Following" pubkeys={[pubkey]} />,
    );

    expect(screen.getByText('Sam')).toBeVisible();
    expect(screen.queryByText('Generated aaaaaa')).not.toBeInTheDocument();
  });

  describe('search', () => {
    const alice = 'a'.repeat(64);
    const bob = 'b'.repeat(64);

    const authors = {
      [alice]: { metadata: { display_name: 'Alice Cooper', name: 'alice' } },
      [bob]: { metadata: { display_name: 'Bob Ross', name: 'bob' } },
    };

    it('sends an eligible query to the server search after input settles', async () => {
      const user = userEvent.setup();
      mockUseBatchedAuthors.mockReturnValue({ data: authors });
      const onSearchQueryChange = vi.fn();

      render(
        <UserListDialog
          open
          onOpenChange={vi.fn()}
          title="Following"
          pubkeys={[alice, bob]}
          onSearchQueryChange={onSearchQueryChange}
        />,
      );

      await user.type(screen.getByRole('searchbox'), 'bob');
      await waitFor(() => expect(onSearchQueryChange).toHaveBeenLastCalledWith('bob'));
    });

    it('clears the query when the dialog closes', async () => {
      const user = userEvent.setup();
      mockUseBatchedAuthors.mockReturnValue({ data: authors });

      const onSearchQueryChange = vi.fn();
      const { rerender } = render(
        <UserListDialog open onOpenChange={vi.fn()} title="Following" pubkeys={[alice, bob]} onSearchQueryChange={onSearchQueryChange} />,
      );

      await user.type(screen.getByRole('searchbox'), 'bob');
      await waitFor(() => expect(onSearchQueryChange).toHaveBeenLastCalledWith('bob'));

      rerender(
        <UserListDialog open={false} onOpenChange={vi.fn()} title="Following" pubkeys={[alice, bob]} onSearchQueryChange={onSearchQueryChange} />,
      );
      rerender(
        <UserListDialog open onOpenChange={vi.fn()} title="Following" pubkeys={[alice, bob]} onSearchQueryChange={onSearchQueryChange} />,
      );

      expect(screen.getByRole('searchbox')).toHaveValue('');
      expect(onSearchQueryChange).toHaveBeenCalledWith('');
    });

    it('keeps profile fetching windowed while server search is active', () => {
      mockUseBatchedAuthors.mockReturnValue({ data: authors });

      const pubkeys = Array.from({ length: 200 }, (_, index) =>
        index.toString(16).padStart(64, '0'));

      render(
        <UserListDialog open onOpenChange={vi.fn()} title="Following" pubkeys={pubkeys} searchQuery="alice" />,
      );

      expect(mockUseBatchedAuthors).toHaveBeenLastCalledWith(
        expect.not.arrayContaining([pubkeys[199]]),
      );
    });

    it('reports no matches without claiming the list is empty', async () => {
      mockUseBatchedAuthors.mockReturnValue({ data: {} });

      render(
        <UserListDialog open onOpenChange={vi.fn()} title="Following" pubkeys={[]} searchQuery="zzzz" />,
      );

      expect(screen.getByText(/no one here matches/i)).toBeVisible();
    });

    it('waits for the server search before reporting no matches', () => {
      mockUseBatchedAuthors.mockReturnValue({ data: {} });

      render(
        <UserListDialog open onOpenChange={vi.fn()} title="Following" pubkeys={[]} searchQuery="zzzz" isLoading />,
      );

      expect(screen.queryByText(/no one here matches/i)).not.toBeInTheDocument();
    });

    it('does not search generated placeholder names locally', async () => {
      const user = userEvent.setup();
      const onSearchQueryChange = vi.fn();
      mockUseBatchedAuthors.mockReturnValue({
        data: { [alice]: { metadata: {} } },
      });

      render(
        <UserListDialog open onOpenChange={vi.fn()} title="Following" pubkeys={[alice]} onSearchQueryChange={onSearchQueryChange} />,
      );

      expect(await screen.findByText('Generated aaaaaa')).toBeVisible();
      await user.type(screen.getByRole('searchbox'), 'generated');

      await waitFor(() => expect(onSearchQueryChange).toHaveBeenLastCalledWith('generated'));
    });

    it('continues paging server-filtered results', () => {
      const onLoadMore = vi.fn();
      mockUseBatchedAuthors.mockReturnValue({ data: authors });

      render(
        <UserListDialog
          open
          onOpenChange={vi.fn()}
          title="Followers"
          pubkeys={[alice, bob]}
          hasMore
          onLoadMore={onLoadMore}
          searchQuery="bob"
        />,
      );

      expect(onLoadMore).toHaveBeenCalled();
    });

    it('does not submit a one-character query', async () => {
      const user = userEvent.setup();
      const onSearchQueryChange = vi.fn();
      mockUseBatchedAuthors.mockReturnValue({ data: authors });

      render(<UserListDialog open onOpenChange={vi.fn()} title="Following" pubkeys={[alice, bob]} onSearchQueryChange={onSearchQueryChange} />);
      await user.type(screen.getByRole('searchbox'), 'a');

      expect(await screen.findByText(/at least 2/i)).toBeVisible();
      await waitFor(() => expect(onSearchQueryChange).toHaveBeenLastCalledWith(''));
    });

    it('reports when authoritative search is unavailable', () => {
      mockUseBatchedAuthors.mockReturnValue({ data: {} });
      render(<UserListDialog open onOpenChange={vi.fn()} title="Followers" pubkeys={[]} searchQuery="alice" isSearchError />);
      expect(screen.getByText(/couldn't search/i)).toBeVisible();
    });

    it('hides the search field when there is nothing to search', () => {
      mockUseBatchedAuthors.mockReturnValue({ data: {} });

      render(
        <UserListDialog open onOpenChange={vi.fn()} title="Following" pubkeys={[]} />,
      );

      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    });
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
