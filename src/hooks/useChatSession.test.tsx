/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { BrowserRouter, MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginDialogProvider, useLoginDialog } from '@/contexts/LoginDialogContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { buildInviteUrl, STOCK_RELAYS } from '@/lib/chat/concord-core/invite';
import { parseInviteUrl, stashInvite } from '@/lib/chat/invite';
import { chatQueryScope } from '@/lib/chat/store';
import { useChatSession } from './useChatSession';

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}));

const ALICE = 'a'.repeat(64);
const BOB = 'b'.repeat(64);

function setUser(pubkey: string | undefined, isAuthPending = false) {
  vi.mocked(useCurrentUser).mockReturnValue(
    { user: pubkey ? { pubkey } : undefined, users: [], signer: undefined, hostedToken: null, isHostedAccount: false, isAuthPending, isRenewingSession: false } as ReturnType<typeof useCurrentUser>,
  );
}

function wrapper({ children }: PropsWithChildren) {
  return (
    <MemoryRouter initialEntries={['/chat/demo-community/general']}>
      <LoginDialogProvider>{children}</LoginDialogProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useChatSession', () => {
  it.each([false, true])('does not resume a legacy fragment on an explicit real invite (logged in: %s)', loggedIn => {
    setUser(loggedIn ? ALICE : undefined);
    sessionStorage.clear();
    window.history.replaceState(null, '', '/invite/naddr1synthetic#community=demo-community&invite=legacy');
    try {
      const { result } = renderHook(() => ({ session: useChatSession(), dialog: useLoginDialog(), location: useLocation() }), { wrapper: ({ children }) => <BrowserRouter><LoginDialogProvider>{children}</LoginDialogProvider></BrowserRouter> });
      expect(result.current.location.pathname).toBe('/invite/naddr1synthetic');
      expect(result.current.dialog.isOpen).toBe(false);
      expect(sessionStorage.getItem('chat:pendingInvite')).toBeNull();
    } finally { window.history.replaceState(null, '', '/'); sessionStorage.clear(); }
  });

  it('prompts login on an invite link a login redirect returned to without its fragment', () => {
    setUser(undefined);
    sessionStorage.clear();
    const invite = new URL(buildInviteUrl('https://chat.example', ALICE, new Uint8Array(16).fill(9), STOCK_RELAYS));
    stashInvite(parseInviteUrl(invite.pathname, invite.hash)!);
    window.history.replaceState(null, '', invite.pathname);
    try {
      const { result } = renderHook(() => ({ session: useChatSession(), dialog: useLoginDialog() }), { wrapper: ({ children }) => <BrowserRouter><LoginDialogProvider>{children}</LoginDialogProvider></BrowserRouter> });
      expect(result.current.dialog.isOpen).toBe(true);
      expect(sessionStorage.getItem('chat:pendingInvite')).not.toBeNull();
    } finally { window.history.replaceState(null, '', '/'); sessionStorage.clear(); }
  });

  it('waits for authentication before prompting a logged-out visitor', () => {
    setUser(undefined, true);
    const { result, rerender } = renderHook(() => ({ session: useChatSession(), dialog: useLoginDialog() }), { wrapper });
    expect(result.current.dialog.isOpen).toBe(false);

    setUser(undefined, false);
    rerender();
    expect(result.current.dialog.isOpen).toBe(true);
  });

  it('opens the login dialog in place for a logged-out visitor and leaves it closed once dismissed', () => {
    setUser(undefined);
    const { result } = renderHook(() => ({ session: useChatSession(), dialog: useLoginDialog() }), { wrapper });
    expect(result.current.dialog.isOpen).toBe(true);
    expect(result.current.session.isLoggedIn).toBe(false);

    act(() => result.current.dialog.closeLoginDialog());
    expect(result.current.dialog.isOpen).toBe(false);
  });

  it('gives an account it switches to its own store', () => {
    setUser(ALICE);
    const { result, rerender } = renderHook(() => useChatSession(), { wrapper });
    // The store is created in an effect, so it shows up on the next render.
    rerender();
    const aliceStore = result.current.store;
    expect(aliceStore?.scope).toBe(chatQueryScope(ALICE));

    setUser(BOB);
    rerender();
    rerender();
    expect(result.current.store?.scope).toBe(chatQueryScope(BOB));
    expect(result.current.store).not.toBe(aliceStore);
  });
});
