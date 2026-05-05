import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NLoginType } from '@nostrify/react/login';

const {
  mockGetValidToken,
  mockJwtSigner,
  mockLogins,
  mockUseAuthor,
} = vi.hoisted(() => ({
  mockGetValidToken: vi.fn<() => string | null>(() => null),
  mockJwtSigner: {
    getPublicKey: vi.fn<() => Promise<string>>(),
    signEvent: vi.fn(),
  },
  mockLogins: [] as NLoginType[],
  mockUseAuthor: vi.fn<(pubkey?: string) => { data: Record<string, never> }>(() => ({ data: {} })),
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
    mockJwtSigner.getPublicKey.mockReset();
    mockJwtSigner.signEvent.mockReset();
    mockUseAuthor.mockClear();
    resetNostrProvider();
  });

  afterEach(() => {
    vi.useRealTimers();
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
  });

  it('does not resolve extension logins when no browser extension is available', () => {
    mockLogins.push({
      id: 'extension:pub123',
      type: 'extension',
      pubkey: 'pub123',
      createdAt: '2026-03-10T00:00:00.000Z',
      data: null,
    });

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.user?.pubkey).toBe('pub123');
    expect(result.current.users).toEqual([{ pubkey: 'pub123' }]);
    expect(result.current.signer).toBeUndefined();
    expect(result.current.isAuthRestoring).toBe(true);
    expect(mockUseAuthor).toHaveBeenCalledWith('pub123');
  });

  it('recovers extension login when provider appears shortly after mount', async () => {
    mockLogins.push({
      id: 'extension:pub123',
      type: 'extension',
      pubkey: 'pub123',
      createdAt: '2026-03-10T00:00:00.000Z',
      data: null,
    });

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.user?.pubkey).toBe('pub123');
    expect(result.current.signer).toBeUndefined();
    expect(result.current.isAuthRestoring).toBe(true);

    await act(async () => {
      setNostrProvider();
    });

    await waitFor(() => {
      expect(result.current.user?.pubkey).toBe('pub123');
      expect(result.current.signer).toBeDefined();
      expect(result.current.isAuthRestoring).toBe(false);
    });
  });

  it('keeps extension auth in restoring mode and recovers after a delayed provider injection', () => {
    vi.useFakeTimers();

    mockLogins.push({
      id: 'extension:pub123',
      type: 'extension',
      pubkey: 'pub123',
      createdAt: '2026-03-10T00:00:00.000Z',
      data: null,
    });

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.user?.pubkey).toBe('pub123');
    expect(result.current.signer).toBeUndefined();
    expect(result.current.isAuthRestoring).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.user?.pubkey).toBe('pub123');
    expect(result.current.isAuthRestoring).toBe(true);

    act(() => {
      setNostrProvider();
      vi.advanceTimersByTime(2500);
    });

    expect(result.current.signer).toBeDefined();
    expect(result.current.isAuthRestoring).toBe(false);
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
});
