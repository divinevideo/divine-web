// ABOUTME: Regression tests for the Discord and YouTube link-up flows on the Linked Accounts page
// ABOUTME: Pins that the typed handle, not the pasted URL or video id, lands in the NIP-39 identity slot

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LinkedAccountsSettingsPage from './LinkedAccountsSettingsPage';

const { mockAdd, mockToast, existing } = vi.hoisted(() => ({
  mockAdd: vi.fn().mockResolvedValue(undefined),
  mockToast: vi.fn(),
  existing: { identities: [] as Array<Record<string, string>> },
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
  useRemoveIdentity: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useExternalIdentities', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/hooks/useExternalIdentities')>();
  return {
    ...actual,
    useExternalIdentities: () => ({ data: existing.identities, isLoading: false }),
    verifyIdentityClaim: vi.fn().mockResolvedValue({ verified: true }),
  };
});

// Every test starts with no linked accounts unless it sets some.
beforeEach(() => {
  existing.identities = [];
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

    expect(mockAdd).not.toHaveBeenCalled();
  });
});

const VIDEO_LINK = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const CHANNEL_ID = 'UC_x5XG1OV2P6uZZ5FSM9Ttw';

async function selectYouTube(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('YouTube'));
}

function channelField() {
  return screen.getByPlaceholderText('linkedAccountsSettings.youtubeChannelPlaceholder');
}

function linkButton() {
  return screen.getByRole('button', { name: /linkedAccountsSettings.linkAccountButton/i });
}

describe('LinkedAccountsSettingsPage YouTube flow', () => {
  beforeEach(() => {
    mockAdd.mockClear();
    mockToast.mockClear();
  });

  function existingYouTube(identity: string, proof: string) {
    existing.identities = [{
      platform: 'youtube',
      identity,
      proof,
      profileUrl: '',
      proofUrl: '',
    }];
  }

  async function editFirst(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByTitle('linkedAccountsSettings.editTooltip'));
  }

  it('asks for the channel again when editing an entry that saved the video id as the channel', async () => {
    // The old fallback published the video id in both slots.
    existingYouTube('dQw4w9WgXcQ', 'dQw4w9WgXcQ');
    const user = userEvent.setup();
    renderPage();
    await editFirst(user);

    expect(channelField()).toHaveValue('');
    expect(screen.getByRole('button', { name: /linkedAccountsSettings.updateAccountButton/i })).toBeDisabled();
  });

  it('shows an older entry in the spelling it will be saved in when editing', async () => {
    existingYouTube(`channel/${CHANNEL_ID}`, 'dQw4w9WgXcQ');
    const user = userEvent.setup();
    renderPage();
    await editFirst(user);

    expect(channelField()).toHaveValue(CHANNEL_ID);
  });

  it('publishes what the channel field shows, even after a channel link was pasted', async () => {
    const user = userEvent.setup();
    renderPage();
    await selectYouTube(user);

    const proofField = screen.getByPlaceholderText(VIDEO_LINK);
    await user.type(proofField, 'https://www.youtube.com/@alice');
    expect(channelField()).toHaveValue('@alice');
    await user.clear(channelField());
    await user.type(channelField(), '@bob');
    await user.click(linkButton());

    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(1));
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ identity: '@bob' }));
  });

  it('publishes the typed handle with its @, not the video id', async () => {
    const user = userEvent.setup();
    renderPage();
    await selectYouTube(user);

    await user.type(channelField(), 'alice');
    await user.type(screen.getByPlaceholderText(VIDEO_LINK), VIDEO_LINK);
    await user.click(linkButton());

    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(1));
    expect(mockAdd).toHaveBeenCalledWith({
      platform: 'youtube',
      identity: '@alice',
      proof: 'dQw4w9WgXcQ',
    });
  });

  it('publishes a typed channel id as it is', async () => {
    const user = userEvent.setup();
    renderPage();
    await selectYouTube(user);

    await user.type(channelField(), CHANNEL_ID);
    await user.type(screen.getByPlaceholderText(VIDEO_LINK), VIDEO_LINK);
    await user.click(linkButton());

    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(1));
    expect(mockAdd).toHaveBeenCalledWith({
      platform: 'youtube',
      identity: CHANNEL_ID,
      proof: 'dQw4w9WgXcQ',
    });
  });

  it('will not publish a video link without a channel', async () => {
    const user = userEvent.setup();
    renderPage();
    await selectYouTube(user);

    await user.type(screen.getByPlaceholderText(VIDEO_LINK), VIDEO_LINK);

    // The old fallback published the video id as the channel, a NIP-39 tag
    // the verifier could never match.
    expect(linkButton()).toBeDisabled();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('refuses a channel the verifier does not accept', async () => {
    const user = userEvent.setup();
    renderPage();
    await selectYouTube(user);

    await user.type(channelField(), 'https://www.youtube.com/c/alice');
    await user.type(screen.getByPlaceholderText(VIDEO_LINK), VIDEO_LINK);
    await user.click(linkButton());

    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      description: 'linkedAccountsSettings.toastInvalidYouTubeChannel',
    }));
  });

  it('fills the channel from a pasted channel link, tidied', async () => {
    const user = userEvent.setup();
    renderPage();
    await selectYouTube(user);

    await user.type(screen.getByPlaceholderText(VIDEO_LINK), `https://www.youtube.com/channel/${CHANNEL_ID}`);

    expect(channelField()).toHaveValue(CHANNEL_ID);
  });
});
