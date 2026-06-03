import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDivineSession } from './useDivineSession';

const { mockRefreshDivineSession } = vi.hoisted(() => ({
  mockRefreshDivineSession: vi.fn<() => Promise<string | null>>(),
}));

vi.mock('@/lib/divineLogin', () => ({
  refreshDivineSession: mockRefreshDivineSession,
}));

function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function createToken(expiresAtSeconds: number): string {
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64Url(JSON.stringify({ exp: expiresAtSeconds, sub: 'user-123' }));
  return `${header}.${payload}.signature`;
}

describe('useDivineSession', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
      clear: () => {
        data.clear();
      },
    };

    vi.stubGlobal('localStorage', storage);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mockRefreshDivineSession.mockReset();
    mockRefreshDivineSession.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps an oauth session even when no email is available', async () => {
    const token = createToken(Math.floor(Date.now() / 1000) + 3600);
    const { result } = renderHook(() => useDivineSession());

    act(() => {
      result.current.saveSession(token, null, false);
    });

    await waitFor(() => {
      expect(result.current.session?.token).toBe(token);
    });

    expect(result.current.session?.email).toBeUndefined();
    expect(result.current.getValidToken()).toBe(token);
  });

  it('syncs a saved session across hook instances in the same tab', async () => {
    const token = createToken(Math.floor(Date.now() / 1000) + 3600);
    const first = renderHook(() => useDivineSession());
    const second = renderHook(() => useDivineSession());

    act(() => {
      first.result.current.saveSession(token, null, false);
    });

    await waitFor(() => {
      expect(second.result.current.session?.token).toBe(token);
    });

    expect(second.result.current.getValidToken()).toBe(token);
  });

  it('proactively renews the access token before it expires', async () => {
    // expires in 30s — inside the 60s refresh lead, so refresh is attempted on mount
    const token = createToken(Math.floor(Date.now() / 1000) + 30);
    const renewed = createToken(Math.floor(Date.now() / 1000) + 3600);
    mockRefreshDivineSession.mockResolvedValue(renewed);

    const { result } = renderHook(() => useDivineSession());

    act(() => {
      result.current.saveSession(token, null, false);
    });

    await waitFor(() => {
      expect(result.current.session?.token).toBe(renewed);
    });
    expect(mockRefreshDivineSession).toHaveBeenCalled();
  });

  it('leaves the session unchanged when refresh is unavailable', async () => {
    const token = createToken(Math.floor(Date.now() / 1000) + 30);
    mockRefreshDivineSession.mockResolvedValue(null);

    const { result } = renderHook(() => useDivineSession());

    act(() => {
      result.current.saveSession(token, null, false);
    });

    await waitFor(() => {
      expect(result.current.session?.token).toBe(token);
    });
    // give the refresh microtask a chance to run, then confirm no change
    await act(async () => { await Promise.resolve(); });
    expect(result.current.session?.token).toBe(token);
  });

  it('getValidToken returns null on expiry without destroying the stored session', async () => {
    const token = createToken(Math.floor(Date.now() / 1000) - 10); // already expired
    const { result } = renderHook(() => useDivineSession());

    act(() => {
      result.current.saveSession(token, null, false);
    });

    await waitFor(() => {
      expect(result.current.session?.token).toBe(token);
    });

    let returned: string | null = 'unset';
    await act(async () => {
      returned = result.current.getValidToken();
      await Promise.resolve();
    });
    expect(returned).toBeNull();
    // session is NOT cleared — a later refresh can still renew it
    expect(result.current.session?.token).toBe(token);
  });
});
