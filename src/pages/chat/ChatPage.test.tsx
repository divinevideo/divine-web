/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChatPage from './ChatPage';
import { buildInviteUrl, STOCK_RELAYS } from '@/lib/chat/concord-core/invite';
import { parseInviteUrl, peekInvite, stashInvite } from '@/lib/chat/invite';
const session = vi.hoisted(() => ({ loggedIn: false, pubkey: 'a'.repeat(64) }));

vi.mock('@/hooks/useChatSession', () => ({
  useChatSession: () => ({ isLoggedIn: session.loggedIn, isAuthPending: false, user: session.loggedIn ? { pubkey: session.pubkey } : undefined, signer: session.loggedIn ? {} : undefined, store: null }),
}));

vi.mock('@/components/auth/LoginArea', () => ({
  LoginArea: () => <button type="button">Log in</button>,
}));

vi.mock('./CommunityChatPage', () => ({ CommunityChatPage: ({ inviteUrl, onVerified }: { inviteUrl: string; onVerified?: (communityId: string) => void }) => <><p data-testid="real-invite">{inviteUrl}</p><button onClick={() => onVerified?.('synthetic-community')}>Community verified</button></> }));
afterEach(() => { vi.unstubAllEnvs(); session.loggedIn = false; session.pubkey = 'a'.repeat(64); sessionStorage.clear(); window.history.replaceState(null, '', '/'); });

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

it('resumes the pending invite when a login redirect returns to its invite link without the fragment', () => {
  session.loggedIn = true;
  const parsed = new URL(buildInviteUrl('https://chat.example', 'a'.repeat(64), new Uint8Array(16).fill(9), STOCK_RELAYS));
  const invite = parseInviteUrl(parsed.pathname, parsed.hash)!;
  stashInvite(invite);
  window.history.replaceState(null, '', parsed.pathname);
  render(<MemoryRouter><ChatPage /></MemoryRouter>);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByTestId('real-invite')).toHaveTextContent(`${invite.naddr}${parsed.hash}`);
});

it('does not resume a pending invite for a different locator on a fragment-less invite link', () => {
  session.loggedIn = true;
  const pending = new URL(buildInviteUrl('https://chat.example', 'a'.repeat(64), new Uint8Array(16).fill(9), STOCK_RELAYS));
  const opened = new URL(buildInviteUrl('https://chat.example', 'b'.repeat(64), new Uint8Array(16).fill(8), STOCK_RELAYS));
  stashInvite(parseInviteUrl(pending.pathname, pending.hash)!);
  window.history.replaceState(null, '', opened.pathname);
  render(<MemoryRouter><ChatPage /></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('This community invite is invalid or incomplete.');
  expect(screen.queryByTestId('real-invite')).not.toBeInTheDocument();
});

it('consumes a verified pending invite while retaining it for the current account session', () => {
  session.loggedIn = true;
  const url = buildInviteUrl('https://chat.example', 'a'.repeat(64), new Uint8Array(16).fill(9), STOCK_RELAYS);
  const parsed = new URL(url);
  const invite = parseInviteUrl(parsed.pathname, parsed.hash)!;
  stashInvite(invite);
  const { rerender } = render(<MemoryRouter><ChatPage /></MemoryRouter>);
  expect(peekInvite()).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Community verified' }));
  expect(peekInvite()).toBeNull();
  rerender(<MemoryRouter><ChatPage /></MemoryRouter>);
  expect(screen.getByTestId('real-invite')).toHaveTextContent(`${invite.naddr}${parsed.hash}`);
});

it.each([false, true])('does not carry a verified URL invite to another account (logout: %s)', logout => {
  session.loggedIn = true;
  const url = buildInviteUrl('https://chat.example', 'a'.repeat(64), new Uint8Array(16).fill(9), STOCK_RELAYS);
  const parsed = new URL(url);
  stashInvite(parseInviteUrl(parsed.pathname, parsed.hash)!);
  const configured = buildInviteUrl('https://approved.example', 'b'.repeat(64), new Uint8Array(16).fill(8), STOCK_RELAYS);
  vi.stubEnv('VITE_CONCORD_INVITE_URL', configured);
  const { rerender } = render(<MemoryRouter><ChatPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Community verified' }));
  if (logout) {
    session.loggedIn = false;
    rerender(<MemoryRouter><ChatPage /></MemoryRouter>);
  }
  session.loggedIn = true;
  session.pubkey = 'c'.repeat(64);
  rerender(<MemoryRouter><ChatPage /></MemoryRouter>);
  expect(screen.getByTestId('real-invite')).toHaveTextContent(configured);
});

it('discards an unverified invite when its account session ends', () => {
  session.loggedIn = true;
  const url = new URL(buildInviteUrl('https://chat.example', 'a'.repeat(64), new Uint8Array(16).fill(9), STOCK_RELAYS));
  stashInvite(parseInviteUrl(url.pathname, url.hash)!);
  const { rerender } = render(<MemoryRouter><ChatPage /></MemoryRouter>);
  session.loggedIn = false;
  rerender(<MemoryRouter><ChatPage /></MemoryRouter>);
  expect(peekInvite()).toBeNull();
});

it('keeps a captured invite through the first login', () => {
  const url = new URL(buildInviteUrl('https://chat.example', 'a'.repeat(64), new Uint8Array(16).fill(9), STOCK_RELAYS));
  const invite = parseInviteUrl(url.pathname, url.hash)!;
  stashInvite(invite);
  const { rerender } = render(<MemoryRouter><ChatPage /></MemoryRouter>);
  session.loggedIn = true;
  rerender(<MemoryRouter><ChatPage /></MemoryRouter>);
  expect(screen.getByTestId('real-invite')).toHaveTextContent(`${invite.naddr}${url.hash}`);
});

it('does not substitute the POC after an account switch without a configured public invite', () => {
  session.loggedIn = true;
  const url = new URL(buildInviteUrl('https://chat.example', 'a'.repeat(64), new Uint8Array(16).fill(9), STOCK_RELAYS));
  stashInvite(parseInviteUrl(url.pathname, url.hash)!);
  vi.stubEnv('VITE_CONCORD_INVITE_URL', '');
  const { rerender } = render(<MemoryRouter><ChatPage /></MemoryRouter>);
  session.pubkey = 'c'.repeat(64);
  rerender(<MemoryRouter><ChatPage /></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('Open a community invite');
  expect(screen.queryByText('Divine test community')).not.toBeInTheDocument();
  expect(screen.queryByTestId('real-invite')).not.toBeInTheDocument();
});
