import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useKeycastSession } from './useKeycastSession';

function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function createToken(expiresAtSeconds: number): string {
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64Url(JSON.stringify({ exp: expiresAtSeconds, sub: 'user-123' }));
  return `${header}.${payload}.signature`;
}

describe('useKeycastSession', () => {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps an oauth session even when no email is available', async () => {
    const token = createToken(Math.floor(Date.now() / 1000) + 3600);
    const { result } = renderHook(() => useKeycastSession());

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
    const first = renderHook(() => useKeycastSession());
    const second = renderHook(() => useKeycastSession());

    act(() => {
      first.result.current.saveSession(token, null, false);
    });

    await waitFor(() => {
      expect(second.result.current.session?.token).toBe(token);
    });

    expect(second.result.current.getValidToken()).toBe(token);
  });
});
