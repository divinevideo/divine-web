import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import ChatPage from './ChatPage';
import fixture from '../../../test-fixtures/concord/community-interop.json';

const { secret } = vi.hoisted(() => ({ secret: new Uint8Array(32).fill(41) }));
vi.mock('@/hooks/useChatSession', () => ({
  useChatSession: () => ({ isLoggedIn: true, isAuthPending: false, user: { pubkey: getPublicKey(secret) }, signer: { signEvent: async (event: Parameters<typeof finalizeEvent>[0]) => finalizeEvent(event, secret) }, store: null }),
}));
vi.mock('@/components/auth/LoginArea', () => ({ LoginArea: () => null }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); sessionStorage.clear(); window.history.replaceState(null, '', '/'); });

describe('configured production community failure', () => {
  it.each(['', '#bad-fragment'])('rejects an explicit real invite without a valid fragment (%j), even with a configured default', async hash => {
    vi.stubEnv('DEV', false); vi.stubEnv('PROD', true); vi.stubEnv('VITE_CONCORD_INVITE_URL', fixture.inviteUrl);
    const path = new URL(fixture.inviteUrl).pathname;
    window.history.replaceState(null, '', path + hash);
    const sockets = vi.fn(); vi.stubGlobal('WebSocket', sockets);
    render(<MemoryRouter><ChatPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('This community invite is invalid or incomplete. Open the complete invite link.');
    expect(screen.queryByText('Divine test community')).not.toBeInTheDocument();
    expect(sockets).not.toHaveBeenCalled();
  });

  it.each(['invalid configured invite', '   '])('shows a verified-community failure instead of the POC for %j', async invite => {
    secret.set(generateSecretKey());
    vi.stubEnv('DEV', false); vi.stubEnv('PROD', true); vi.stubEnv('VITE_CONCORD_INVITE_URL', invite);
    const sockets = vi.fn(); vi.stubGlobal('WebSocket', sockets);
    render(<MemoryRouter><ChatPage /></MemoryRouter>);
    expect(await screen.findByText('Could not verify or load this community. Try again.')).toBeInTheDocument();
    expect(screen.queryByText('Divine test community')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled();
    expect(sockets).not.toHaveBeenCalled();
  });
});
