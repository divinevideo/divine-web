import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NLoginType } from '@nostrify/react/login';

const mockLogins: NLoginType[] = [];
const mockUseAuthor = vi.fn<(pubkey?: string) => { data: Record<string, never> }>(() => ({ data: {} }));

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
    mockUseAuthor.mockClear();
    resetNostrProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetNostrProvider();
  });

  it('skips extension logins when no browser extension is available', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockLogins.push({
      id: 'extension:pub123',
      type: 'extension',
      pubkey: 'pub123',
      createdAt: '2026-03-10T00:00:00.000Z',
      data: null,
    });

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.user).toBeUndefined();
    expect(result.current.users).toEqual([]);
    expect(result.current.signer).toBeUndefined();
    expect(mockUseAuthor).toHaveBeenCalledWith(undefined);
    expect(warnSpy).toHaveBeenCalledWith('Skipped invalid login', 'extension:pub123', expect.any(Error));
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
