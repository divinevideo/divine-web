/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChatPage from './ChatPage';
import { buildInviteUrl, STOCK_RELAYS } from '@/lib/chat/concord-core/invite';
import { parseInviteUrl, stashInvite } from '@/lib/chat/invite';
const session = vi.hoisted(() => ({ loggedIn: false }));

vi.mock('@/hooks/useChatSession', () => ({
  useChatSession: () => ({ isLoggedIn: session.loggedIn, isAuthPending: false, user: session.loggedIn ? { pubkey: 'a'.repeat(64) } : undefined, signer: session.loggedIn ? {} : undefined, store: null }),
}));

vi.mock('@/components/auth/LoginArea', () => ({
  LoginArea: () => <button type="button">Log in</button>,
}));

vi.mock('./CommunityChatPage', () => ({ CommunityChatPage: ({ inviteUrl }: { inviteUrl: string }) => <p data-testid="real-invite">{inviteUrl}</p> }));
afterEach(() => { session.loggedIn = false; sessionStorage.clear(); window.history.replaceState(null, '', '/'); });

describe('ChatPage', () => {
  it('gives a logged-out visitor a login control on invite links, which render outside the app layout', () => {
    render(
      <MemoryRouter initialEntries={['/invite/naddr1xyz']}>
        <Routes>
          <Route path="/invite/:code" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });
});

it.each(['captured', 'stashed', 'legacy-stash'])('opens a standard stock-relay invite through %s without re-encoding it as a three-relay link', mode => {
  session.loggedIn = true;
  const url = buildInviteUrl('https://chat.example', 'a'.repeat(64), new Uint8Array(16).fill(9), STOCK_RELAYS);
  const parsed = new URL(url);
  const invite = parseInviteUrl(parsed.pathname, parsed.hash)!;
  if (mode === 'captured') window.history.replaceState(null, '', parsed.pathname + parsed.hash);
  else if (mode === 'stashed') stashInvite(invite);
  else stashInvite({ naddr: invite.naddr, tokenHex: invite.tokenHex, relays: invite.relays });
  render(<MemoryRouter><ChatPage /></MemoryRouter>);
  expect(screen.getByTestId('real-invite')).toHaveTextContent(`${invite.naddr}${parsed.hash}`);
});
