// ABOUTME: Regression tests for the Discord link-up flow on the Linked Accounts page
// ABOUTME: Pins that the typed username, not the pasted URL, lands in the NIP-39 identity slot

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LinkedAccountsSettingsPage from './LinkedAccountsSettingsPage';

const { mockAdd, mockRemove, mockToast, state } = vi.hoisted(() => ({
  mockAdd: vi.fn().mockResolvedValue(undefined),
  mockRemove: vi.fn(),
  mockToast: vi.fn(),
  state: { identities: [] as unknown[] },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: '0'.repeat(64) }, metadata: undefined }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/hooks/usePublishIdentity', () => ({
  useAddIdentity: () => ({ mutateAsync: mockAdd, isPending: false }),
  useRemoveIdentity: () => ({ mutateAsync: mockRemove, isPending: false }),
}));

vi.mock('@/hooks/useExternalIdentities', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/hooks/useExternalIdentities')>();
  return {
    ...actual,
    useExternalIdentities: () => ({ data: state.identities, isLoading: false }),
    verifyIdentityClaim: vi.fn().mockResolvedValue({ verified: true }),
  };
});

const MESSAGE_LINK =
  'https://discord.com/channels/1234567890123456789/9876543210987654321/1111222233334444555';

function renderPage() {
  return render(
    <MemoryRouter>
      <LinkedAccountsSettingsPage />
    </MemoryRouter>,
  );
}

async function selectDiscord(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('Discord'));
}

beforeEach(() => {
  state.identities = [];
  mockAdd.mockClear();
  mockRemove.mockReset();
  mockToast.mockClear();
});

describe('LinkedAccountsSettingsPage Discord flow', () => {
  it('publishes the typed username, not the pasted link, as the identity', async () => {
    const user = userEvent.setup();
    renderPage();
    await selectDiscord(user);

    await user.type(
      screen.getByPlaceholderText('linkedAccountsSettings.discordUsernamePlaceholder'),
      'alice',
    );
    await user.type(
      screen.getByPlaceholderText('https://discord.com/channels/.../.../...'),
      MESSAGE_LINK,
    );
    await user.click(screen.getByRole('button', { name: /linkedAccountsSettings.linkAccountButton/i }));

    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(1));
    expect(mockAdd).toHaveBeenCalledWith({
      platform: 'discord',
      identity: 'alice',
      proof: MESSAGE_LINK,
    });
  });

  it('will not publish a Discord link without a username', async () => {
    const user = userEvent.setup();
    renderPage();
    await selectDiscord(user);

    await user.type(
      screen.getByPlaceholderText('https://discord.com/channels/.../.../...'),
      MESSAGE_LINK,
    );

    // The old fallback put the whole message URL in the identity slot, which
    // published an unverifiable NIP-39 tag before verification even ran.
    expect(
      screen.getByRole('button', { name: /linkedAccountsSettings.linkAccountButton/i }),
    ).toBeDisabled();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('refuses a proof that is not a message link', async () => {
    const user = userEvent.setup();
    renderPage();
    await selectDiscord(user);

    await user.type(
      screen.getByPlaceholderText('linkedAccountsSettings.discordUsernamePlaceholder'),
      'alice',
    );
    await user.type(
      screen.getByPlaceholderText('https://discord.com/channels/.../.../...'),
      'https://discord.gg/AbCdEf',
    );
    await user.click(screen.getByRole('button', { name: /linkedAccountsSettings.linkAccountButton/i }));

    expect(mockAdd).not.toHaveBeenCalled();
  });
});

const BLUESKY_ROW = {
  platform: 'bluesky',
  identity: 'alice.bsky.social',
  proof: 'oauth',
  profileUrl: '',
  proofUrl: '',
};

describe('LinkedAccountsSettingsPage unlinking', () => {
  it('warns when the sign-in record could not be cleared, and keeps the removal', async () => {
    const user = userEvent.setup();
    state.identities = [BLUESKY_ROW];
    mockRemove.mockResolvedValueOnce({ event: {}, signIn: { revoked: false, code: 'unlink_claim_listed' } });
    renderPage();

    await user.click(screen.getByTitle('linkedAccountsSettings.removeTooltip'));

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith({
      title: 'linkedAccountsSettings.toastRemovedTitle',
      description: 'linkedAccountsSettings.toastSignInNotCleared',
    }));
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    expect(mockRemove).toHaveBeenCalledWith({ platform: 'bluesky', identity: 'alice.bsky.social' });
  });

  it.each([
    ['the record was cleared', { revoked: true }],
    ['the platform has no sign-in', null],
  ])('confirms a plain unlink when %s', async (_label, signIn) => {
    const user = userEvent.setup();
    state.identities = [BLUESKY_ROW];
    mockRemove.mockResolvedValueOnce({ event: {}, signIn });
    renderPage();

    await user.click(screen.getByTitle('linkedAccountsSettings.removeTooltip'));

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith({
      title: 'linkedAccountsSettings.toastRemovedTitle',
      description: 'linkedAccountsSettings.toastAccountUnlinked',
    }));
  });
});
