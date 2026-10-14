import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSecretKey, nip19 } from 'nostr-tools';
import type { NLoginType } from '@nostrify/react/login';

import {
  NIP07_GRACE_MS,
  NIP07_POLL_INTERVAL_MS,
  resetNip07Availability,
} from './useNip07Availability';

const {
  mockGetValidToken,
  mockIsExpired,
  mockJwtSigner,
  mockLogins,
  mockReleaseBunkerSignersExcept,
  mockUseAuthor,
} = vi.hoisted(() => ({
  mockGetValidToken: vi.fn<() => string | null>(() => null),
  mockIsExpired: { value: false },
  mockJwtSigner: {
    getPublicKey: vi.fn<() => Promise<string>>(),
    signEvent: vi.fn(),
  },
  mockLogins: [] as NLoginType[],
  mockReleaseBunkerSignersExcept: vi.fn<(ids: Iterable<string>) => void>(),
  mockUseAuthor: vi.fn<(pubkey?: string) => { data: Record<string, never> }>(() => ({ data: {} })),
}));

vi.mock('@/lib/bunkerSignerRegistry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bunkerSignerRegistry')>()),
  releaseBunkerSignersExcept: (ids: Iterable<string>) => mockReleaseBunkerSignersExcept(ids),
}));

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: {} }),
}));

vi.mock('@nostrify/react/login', async () => {
  const actual = await vi.importActual<typeof import('@nostrify/react/login')>('@nostrify/react/login');
  return {
    ...actual,
    useNostrLogin: () => ({ logins: mockLogins }),
  };
});

vi.mock('./useAuthor.ts', () => ({
  useAuthor: (pubkey?: string) => mockUseAuthor(pubkey),
}));

vi.mock('@/hooks/useDivineSession', () => ({
  useDivineSession: () => ({
    getValidToken: mockGetValidToken,
    isExpired: mockIsExpired.value,
  }),
}));

vi.mock('@/lib/DivineJWTSigner', () => ({
  DivineJWTSigner: vi.fn(() => mockJwtSigner),
}));

import { useCurrentUser } from './useCurrentUser';

const originalNostrDescriptor = Object.getOwnPropertyDescriptor(window, 'nostr');

function resetNostrProvider() {
  if (originalNostrDescriptor) {
    Object.defineProperty(window, 'nostr', originalNostrDescriptor);
    return;
  }

  delete (window as Window & { nostr?: unknown }).nostr;
}

function setNostrProvider(value: unknown = { getPublicKey: vi.fn() }) {
  Object.defineProperty(window, 'nostr', {
    value,
    writable: true,
    configurable: true,
  });
}

describe('useCurrentUser', () => {
  beforeEach(() => {
    mockLogins.length = 0;
    mockGetValidToken.mockReset();
    mockGetValidToken.mockReturnValue(null);
    mockIsExpired.value = false;
    mockJwtSigner.getPublicKey.mockReset();
    mockJwtSigner.signEvent.mockReset();
    mockUseAuthor.mockClear();
    mockReleaseBunkerSignersExcept.mockClear();
    resetNostrProvider();
    resetNip07Availability();
  });

  // A removed login's signer is the last thing holding its sockets open, and
  // nothing else releases it.
  describe('bunker signer release', () => {
    const bunkerLogin = (id: string): NLoginType => ({
      id,
      type: 'bunker',
      pubkey: id.slice(-64).padStart(64, 'd'),
      createdAt: '2026-03-10T00:00:00.000Z',
      data: {
        bunkerPubkey: 'b'.repeat(64),
        clientNsec: 'nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
        relays: ['wss://relay.example'],
      },
    });

    it('keeps the signers of every surviving login', () => {
      mockLogins.push(bunkerLogin('bunker:one'), bunkerLogin('bunker:two'));

      renderHook(() => useCurrentUser());

      expect(mockReleaseBunkerSignersExcept).toHaveBeenCalledWith(['bunker:one', 'bunker:two']);
    });

    it('releases everything once the last login is gone', () => {
      renderHook(() => useCurrentUser());

      expect(mockReleaseBunkerSignersExcept).toHaveBeenCalledWith([]);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetNostrProvider();
  });

  it('returns a JWT-backed current user and signer when a valid web session exists', async () => {
    mockGetValidToken.mockReturnValue('jwt-token');
    mockJwtSigner.getPublicKey.mockResolvedValue('b'.repeat(64));

    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => {
      expect(result.current.user?.pubkey).toBe('b'.repeat(64));
    });

    expect(result.current.users).toHaveLength(1);
    expect(result.current.signer).toBe(mockJwtSigner);
    expect(result.current.hostedToken).toBe('jwt-token');
    expect(mockUseAuthor).toHaveBeenCalledWith('b'.repeat(64));
  });

  it('prefers the JWT-backed session over manual logins', async () => {
    mockGetValidToken.mockReturnValue('jwt-token');
    mockJwtSigner.getPublicKey.mockResolvedValue('c'.repeat(64));
    setNostrProvider();

    mockLogins.push({
      id: 'extension:manualpub',
      type: 'extension',
      pubkey: 'manualpub',
      createdAt: '2026-03-10T00:00:00.000Z',
      data: null,
    });

    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => {
      expect(result.current.user?.pubkey).toBe('c'.repeat(64));
    });

    expect(result.current.users).toHaveLength(1);
    expect(result.current.signer).toBe(mockJwtSigner);
  });

  it('does not expose an expired hosted token for key export', async () => {
    mockGetValidToken.mockReturnValue('expired-token');
    mockIsExpired.value = true;
    mockJwtSigner.getPublicKey.mockResolvedValue('e'.repeat(64));

    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => expect(result.current.user?.pubkey).toBe('e'.repeat(64)));
    expect(result.current.hostedToken).toBeNull();
    expect(result.current.isHostedAccount).toBe(true);
  });

  it('does not fall back to a manual account while a JWT session is still initializing', () => {
    mockGetValidToken.mockReturnValue('jwt-token');
    mockJwtSigner.getPublicKey.mockReturnValue(new Promise(() => {}));
    setNostrProvider();

    mockLogins.push({
      id: 'extension:manualpub',
      type: 'extension',
      pubkey: 'manualpub',
      createdAt: '2026-03-10T00:00:00.000Z',
      data: null,
    });

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.user).toBeUndefined();
    expect(result.current.users).toEqual([]);
    expect(result.current.signer).toBeUndefined();
    expect(result.current.isAuthPending).toBe(true);
  });

  it('falls back to a manual account when the JWT session fails to initialize', async () => {
    mockGetValidToken.mockReturnValue('jwt-token');
    mockJwtSigner.getPublicKey.mockRejectedValue(new Error('rpc failed'));
    setNostrProvider();

    mockLogins.push({
      id: 'extension:manualpub',
      type: 'extension',
      pubkey: 'manualpub',
      createdAt: '2026-03-10T00:00:00.000Z',
      data: null,
    });

    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => {
      expect(result.current.user?.pubkey).toBe('manualpub');
    });
    expect(result.current.users).toHaveLength(1);
    expect(result.current.signer).toBeDefined();
    expect(result.current.hostedToken).toBeNull();
  });

  it('does not expose a hosted token when JWT resolution fails without a current user', async () => {
    mockGetValidToken.mockReturnValue('jwt-token');
    mockJwtSigner.getPublicKey.mockRejectedValue(new Error('rpc failed'));

    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => expect(result.current.isAuthPending).toBe(false));
    expect(result.current.user).toBeUndefined();
    expect(result.current.hostedToken).toBeNull();
  });

  it('reports sign-in as still loading while a hosted session initializes, then clears it', async () => {
    mockGetValidToken.mockReturnValue('jwt-token');
    let resolvePubkey: (pubkey: string) => void = () => {};
    mockJwtSigner.getPublicKey.mockReturnValue(
      new Promise<string>((resolve) => { resolvePubkey = resolve; }),
    );

    const { result } = renderHook(() => useCurrentUser());

    // initializing
    expect(result.current.isAuthPending).toBe(true);
    expect(result.current.user).toBeUndefined();

    resolvePubkey('d'.repeat(64));

    await waitFor(() => {
      expect(result.current.user?.pubkey).toBe('d'.repeat(64));
    });
    expect(result.current.isAuthPending).toBe(false);
  });

  it('does not pair a stale pubkey with the new signer after a token swap', async () => {
    mockGetValidToken.mockReturnValue('token-A');
    mockJwtSigner.getPublicKey
      .mockResolvedValueOnce('a'.repeat(64))
      .mockReturnValue(new Promise(() => {})); // token-B never resolves during the test

    const { result, rerender } = renderHook(() => useCurrentUser());

    await waitFor(() => {
      expect(result.current.user?.pubkey).toBe('a'.repeat(64));
    });

    // swap to a new token; its pubkey hasn't resolved yet
    mockGetValidToken.mockReturnValue('token-B');
    rerender();

    // must NOT briefly show token-A's pubkey paired with the token-B signer
    expect(result.current.user).toBeUndefined();
    expect(result.current.isAuthPending).toBe(true);
  });

  // The router keeps a logged-in page mounted through a renewal, and only a
  // renewal, so the page keeps what it holds without showing the signed-out
  // fallback of some other pending sign-in.
  describe('telling a token renewal apart from a new sign-in', () => {
    // keycast access tokens are UCANs that name their account in `aud`, the
    // user's DID. Only the payload matters here.
    function hostedToken(account: string, nonce: string): string {
      return `header.${btoa(JSON.stringify({ aud: account, nnc: nonce }))}.signature`;
    }
    const ACCOUNT_A = 'did:key:account-a';
    const ACCOUNT_B = 'did:key:account-b';

    async function signInWithHostedToken(token: string) {
      mockGetValidToken.mockReturnValue(token);
      mockJwtSigner.getPublicKey
        .mockResolvedValueOnce('a'.repeat(64))
        .mockReturnValue(new Promise(() => {}));

      const hook = renderHook(() => useCurrentUser());
      await waitFor(() => {
        expect(hook.result.current.user?.pubkey).toBe('a'.repeat(64));
      });
      return hook;
    }

    it('reports a signed-in hosted session renewing its token as a renewal', async () => {
      const { result, rerender } = await signInWithHostedToken(hostedToken(ACCOUNT_A, '1'));
      expect(result.current.isRenewingSession).toBe(false);

      mockGetValidToken.mockReturnValue(hostedToken(ACCOUNT_A, '2'));
      rerender();

      expect(result.current.isAuthPending).toBe(true);
      expect(result.current.isRenewingSession).toBe(true);
    });

    // The page stays mounted through a renewal, so a token for another
    // account must not count as one, or that account would inherit the page.
    it('does not report a token for a different account as a renewal', async () => {
      const { result, rerender } = await signInWithHostedToken(hostedToken(ACCOUNT_A, '1'));

      mockGetValidToken.mockReturnValue(hostedToken(ACCOUNT_B, '2'));
      rerender();

      expect(result.current.isAuthPending).toBe(true);
      expect(result.current.isRenewingSession).toBe(false);
    });

    it('does not report a renewal when the tokens do not name their account', async () => {
      const { result, rerender } = await signInWithHostedToken('token-A');

      mockGetValidToken.mockReturnValue('token-B');
      rerender();

      expect(result.current.isAuthPending).toBe(true);
      expect(result.current.isRenewingSession).toBe(false);
    });

    it('does not report a first hosted sign-in as a renewal', () => {
      mockGetValidToken.mockReturnValue(hostedToken(ACCOUNT_A, '1'));
      mockJwtSigner.getPublicKey.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useCurrentUser());

      expect(result.current.isAuthPending).toBe(true);
      expect(result.current.isRenewingSession).toBe(false);
    });

    it('does not report a hosted sign-in after the session ended as a renewal', async () => {
      const { result, rerender } = await signInWithHostedToken(hostedToken(ACCOUNT_A, '1'));

      mockGetValidToken.mockReturnValue(null);
      rerender();
      expect(result.current.user).toBeUndefined();

      mockGetValidToken.mockReturnValue(hostedToken(ACCOUNT_A, '2'));
      rerender();

      expect(result.current.isAuthPending).toBe(true);
      expect(result.current.isRenewingSession).toBe(false);
    });
  });

  it('recovers an extension login when the provider injects shortly after mount', () => {
    vi.useFakeTimers();
    try {
      mockLogins.push({
        id: 'extension:pub123',
        type: 'extension',
        pubkey: 'pub123',
        createdAt: '2026-03-10T00:00:00.000Z',
        data: null,
      });

      const { result } = renderHook(() => useCurrentUser());

      // Extension content script hasn't injected window.nostr yet.
      expect(result.current.user).toBeUndefined();

      setNostrProvider();
      act(() => {
        vi.advanceTimersByTime(NIP07_POLL_INTERVAL_MS);
      });

      expect(result.current.user?.pubkey).toBe('pub123');
      expect(result.current.signer).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips extension logins without a Sentry-visible warning when no extension appears', () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      mockLogins.push({
        id: 'extension:pub123',
        type: 'extension',
        pubkey: 'pub123',
        createdAt: '2026-03-10T00:00:00.000Z',
        data: null,
      });

      const { result } = renderHook(() => useCurrentUser());

      // While the grace period runs, nothing is logged at all.
      expect(result.current.user).toBeUndefined();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(NIP07_GRACE_MS + NIP07_POLL_INTERVAL_MS);
      });

      expect(result.current.user).toBeUndefined();
      expect(result.current.users).toEqual([]);
      expect(result.current.signer).toBeUndefined();
      // Sentry captures console.warn/error; a missing extension is an expected
      // state and must stay at info level.
      expect(warnSpy).not.toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledWith(
        'Skipped extension login; no NIP-07 provider found',
        'extension:pub123',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('picks up an extension that loads after the grace period once the tab regains focus', () => {
    vi.useFakeTimers();
    try {
      mockLogins.push({
        id: 'extension:pub123',
        type: 'extension',
        pubkey: 'pub123',
        createdAt: '2026-03-10T00:00:00.000Z',
        data: null,
      });

      const { result } = renderHook(() => useCurrentUser());
      act(() => {
        vi.advanceTimersByTime(NIP07_GRACE_MS + NIP07_POLL_INTERVAL_MS);
      });
      expect(result.current.user).toBeUndefined();

      setNostrProvider();
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      expect(result.current.user?.pubkey).toBe('pub123');
      expect(result.current.signer).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps components that mounted before a slow extension loaded in step with later ones', () => {
    vi.useFakeTimers();
    try {
      mockLogins.push({
        id: 'extension:pub123',
        type: 'extension',
        pubkey: 'pub123',
        createdAt: '2026-03-10T00:00:00.000Z',
        data: null,
      });

      const early = renderHook(() => useCurrentUser());
      act(() => {
        vi.advanceTimersByTime(NIP07_GRACE_MS + NIP07_POLL_INTERVAL_MS);
      });

      setNostrProvider();
      const late = renderHook(() => useCurrentUser());

      expect(late.result.current.user?.pubkey).toBe('pub123');
      expect(early.result.current.user?.pubkey).toBe('pub123');
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns an extension user and signer when a browser extension is available', () => {
    setNostrProvider();

    mockLogins.push({
      id: 'extension:pub123',
      type: 'extension',
      pubkey: 'pub123',
      createdAt: '2026-03-10T00:00:00.000Z',
      data: null,
    });

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.user?.pubkey).toBe('pub123');
    expect(result.current.users).toHaveLength(1);
    expect(result.current.signer).toBeDefined();
    expect(mockUseAuthor).toHaveBeenCalledWith('pub123');
  });

  // A reload with a saved extension login has a moment where the extension has
  // not loaded yet. That is "still signing in", not "logged out", and nothing
  // should look logged in as anyone else meanwhile (divine-web#266).
  describe('while a saved extension login waits for the extension', () => {
    const extensionLogin: NLoginType = {
      id: 'extension:pub123',
      type: 'extension',
      pubkey: 'pub123',
      createdAt: '2026-03-10T00:00:00.000Z',
      data: null,
    };
    const nsecLogin: NLoginType = {
      id: `nsec:${'b'.repeat(64)}`,
      type: 'nsec',
      pubkey: 'b'.repeat(64),
      createdAt: '2026-03-10T00:00:00.000Z',
      data: { nsec: nip19.nsecEncode(generateSecretKey()) },
    };

    function settleWithoutExtension() {
      act(() => {
        vi.advanceTimersByTime(NIP07_GRACE_MS + NIP07_POLL_INTERVAL_MS);
      });
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('reports sign-in as still loading, then signs in once the extension loads', () => {
      mockLogins.push(extensionLogin);

      const { result } = renderHook(() => useCurrentUser());

      expect(result.current.user).toBeUndefined();
      expect(result.current.isAuthPending).toBe(true);

      setNostrProvider();
      act(() => {
        vi.advanceTimersByTime(NIP07_POLL_INTERVAL_MS);
      });

      expect(result.current.user?.pubkey).toBe('pub123');
      expect(result.current.isAuthPending).toBe(false);
    });

    it('stops reporting sign-in as loading once the wait for the extension runs out', () => {
      mockLogins.push(extensionLogin);

      const { result } = renderHook(() => useCurrentUser());
      settleWithoutExtension();

      expect(result.current.user).toBeUndefined();
      expect(result.current.isAuthPending).toBe(false);
    });

    it('does not briefly show the next saved account as current', () => {
      mockLogins.push(extensionLogin, nsecLogin);

      const { result } = renderHook(() => useCurrentUser());

      expect(result.current.user).toBeUndefined();
      expect(result.current.users).toEqual([]);
      expect(result.current.isAuthPending).toBe(true);

      setNostrProvider();
      act(() => {
        vi.advanceTimersByTime(NIP07_POLL_INTERVAL_MS);
      });

      expect(result.current.user?.pubkey).toBe('pub123');
    });

    it('falls back to the next saved account once the wait for the extension runs out', () => {
      mockLogins.push(extensionLogin, nsecLogin);

      const { result } = renderHook(() => useCurrentUser());
      settleWithoutExtension();

      expect(result.current.user?.pubkey).toBe('b'.repeat(64));
      expect(result.current.signer).toBeDefined();
      expect(result.current.isAuthPending).toBe(false);
    });

    it('does not hold up an account that comes before the extension login', () => {
      mockLogins.push(nsecLogin, extensionLogin);

      const { result } = renderHook(() => useCurrentUser());

      expect(result.current.user?.pubkey).toBe('b'.repeat(64));
      expect(result.current.isAuthPending).toBe(false);
    });

    it('lets a resolved hosted session take precedence over the wait', async () => {
      vi.useRealTimers();
      mockGetValidToken.mockReturnValue('jwt-token');
      mockJwtSigner.getPublicKey.mockResolvedValue('c'.repeat(64));
      mockLogins.push(extensionLogin);

      const { result } = renderHook(() => useCurrentUser());

      await waitFor(() => expect(result.current.user?.pubkey).toBe('c'.repeat(64)));
      expect(result.current.isAuthPending).toBe(false);
    });
  });
});
