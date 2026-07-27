import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NLoginType } from '@nostrify/react/login';

import { NIP07_POLL_INTERVAL_MS } from './useNip07Availability';

type MockCurrentUserResult = {
  metadata?: { name?: string };
  user?: { pubkey: string };
};

const {
  mockGetValidToken,
  mockLogins,
  mockRemoveLogin,
  mockSetLogin,
  mockUseCurrentUser,
} = vi.hoisted(() => ({
  mockGetValidToken: vi.fn<() => string | null>(() => null),
  mockLogins: [] as NLoginType[],
  mockRemoveLogin: vi.fn(),
  mockSetLogin: vi.fn(),
  mockUseCurrentUser: vi.fn<() => MockCurrentUserResult>(() => ({ user: undefined, metadata: undefined })),
}));

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: vi.fn(),
    },
  }),
}));

vi.mock('@nostrify/react/login', async () => {
  const actual = await vi.importActual<typeof import('@nostrify/react/login')>('@nostrify/react/login');
  return {
    ...actual,
    useNostrLogin: () => ({
      logins: mockLogins,
      removeLogin: mockRemoveLogin,
      setLogin: mockSetLogin,
    }),
  };
});

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: [] })),
  };
});

vi.mock('./useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock('./useDivineSession', () => ({
  useDivineSession: () => ({
    getValidToken: mockGetValidToken,
  }),
}));

import { useLoggedInAccounts } from './useLoggedInAccounts';

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

describe('useLoggedInAccounts', () => {
  beforeEach(() => {
    mockGetValidToken.mockReset();
    mockGetValidToken.mockReturnValue(null);
    mockLogins.length = 0;
    mockRemoveLogin.mockClear();
    mockSetLogin.mockClear();
    mockUseCurrentUser.mockReset();
    mockUseCurrentUser.mockReturnValue({ user: undefined, metadata: undefined });
    resetNostrProvider();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetNostrProvider();
  });

  it('treats a JWT-backed web session as the current account', () => {
    const pubkey = 'a'.repeat(64);

    mockGetValidToken.mockReturnValue('jwt-token');
    mockUseCurrentUser.mockReturnValue({
      metadata: { name: 'JWT User' },
      user: { pubkey },
    });

    const { result } = renderHook(() => useLoggedInAccounts());

    expect(result.current.currentUser).toEqual({
      id: `jwt:${pubkey}`,
      metadata: { name: 'JWT User' },
      pubkey,
    });
    expect(result.current.authors).toEqual([
      {
        id: `jwt:${pubkey}`,
        metadata: { name: 'JWT User' },
        pubkey,
      },
    ]);
    expect(result.current.otherUsers).toEqual([]);
    expect(result.current.setLogin).toBe(mockSetLogin);
    expect(result.current.removeLogin).toBe(mockRemoveLogin);
  });

  it('recovers an extension account when the provider injects shortly after mount', () => {
    vi.useFakeTimers();

    mockLogins.push({
      id: 'extension:pub123',
      type: 'extension',
      pubkey: 'pub123',
      createdAt: '2026-03-10T00:00:00.000Z',
      data: null,
    });

    const { result } = renderHook(() => useLoggedInAccounts());

    // Extension content script hasn't injected window.nostr yet.
    expect(result.current.currentUser).toBeUndefined();

    setNostrProvider();
    act(() => {
      vi.advanceTimersByTime(NIP07_POLL_INTERVAL_MS);
    });

    expect(result.current.currentUser?.pubkey).toBe('pub123');
  });
});
