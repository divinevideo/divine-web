// ABOUTME: Regression tests for the Discord link-up flow on the Linked Accounts page
// ABOUTME: Pins that the typed username, not the pasted URL, lands in the NIP-39 identity slot

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LinkedAccountsSettingsPage from './LinkedAccountsSettingsPage';

const { mockAdd } = vi.hoisted(() => ({
  mockAdd: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: '0'.repeat(64) }, metadata: undefined }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/usePublishIdentity', () => ({
  useAddIdentity: () => ({ mutateAsync: mockAdd, isPending: false }),
  useRemoveIdentity: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useExternalIdentities', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/hooks/useExternalIdentities')>();
  return {
    ...actual,
    useExternalIdentities: () => ({ data: [], isLoading: false }),
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

describe('LinkedAccountsSettingsPage Discord flow', () => {
  beforeEach(() => {
    mockAdd.mockClear();
  });

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

    await waitFor(() => expect(mockAdd).not.toHaveBeenCalled());
  });
});
