import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockCurrentUserResult = {
  metadata?: { name?: string };
  user?: { pubkey: string };
};

const {
  mockGetValidToken,
  mockRemoveLogin,
  mockSetLogin,
  mockUseCurrentUser,
} = vi.hoisted(() => ({
  mockGetValidToken: vi.fn<() => string | null>(() => null),
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

vi.mock('@nostrify/react/login', () => ({
  useNostrLogin: () => ({
    logins: [],
    removeLogin: mockRemoveLogin,
    setLogin: mockSetLogin,
  }),
}));

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

describe('useLoggedInAccounts', () => {
  beforeEach(() => {
    mockGetValidToken.mockReset();
    mockGetValidToken.mockReturnValue(null);
    mockRemoveLogin.mockClear();
    mockSetLogin.mockClear();
    mockUseCurrentUser.mockReset();
    mockUseCurrentUser.mockReturnValue({ user: undefined, metadata: undefined });
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
});
