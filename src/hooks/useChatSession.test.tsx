/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginDialogProvider, useLoginDialog } from '@/contexts/LoginDialogContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
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
