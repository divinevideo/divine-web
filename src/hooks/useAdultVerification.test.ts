import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkMediaAuth, useAdultVerification } from './useAdultVerification';
import { createMediaViewerAuthHeader } from '@/lib/mediaViewerAuth';

const mockSigner = { signEvent: vi.fn(), getPublicKey: vi.fn() };

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ signer: mockSigner, pubkey: 'pub', user: { pubkey: 'pub' } }),
}));

vi.mock('@/lib/mediaViewerAuth', () => ({
  createMediaViewerAuthHeader: vi.fn(),
}));

function installMemoryStorage(): void {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => {
        store.delete(key);
      },
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
    } satisfies Storage,
  });
}

describe('useAdultVerification', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it('synchronizes confirmation across mounted hook instances', async () => {
    const first = renderHook(() => useAdultVerification());
    const second = renderHook(() => useAdultVerification());

    await waitFor(() => {
      expect(first.result.current.isLoading).toBe(false);
      expect(second.result.current.isLoading).toBe(false);
    });

    expect(first.result.current.isVerified).toBe(false);
    expect(second.result.current.isVerified).toBe(false);

    act(() => {
      first.result.current.confirmAdult();
    });

    await waitFor(() => {
      expect(second.result.current.isVerified).toBe(true);
    });
  });

  describe('getAuthHeader', () => {
    const HASH = 'a'.repeat(64);
    const URL = 'https://media.divine.video/file.mp4';

    beforeEach(() => {
      vi.mocked(createMediaViewerAuthHeader).mockReset().mockResolvedValue('Nostr HEADER');
    });

    it('returns null when not verified', async () => {
      const { result } = renderHook(() => useAdultVerification());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const header = await result.current.getAuthHeader(URL);
      expect(header).toBeNull();
      expect(createMediaViewerAuthHeader).not.toHaveBeenCalled();
    });

    it('forwards url-only to the picker after confirmAdult', async () => {
      const { result } = renderHook(() => useAdultVerification());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.confirmAdult());

      const header = await result.current.getAuthHeader(URL);
      expect(header).toBe('Nostr HEADER');
      expect(createMediaViewerAuthHeader).toHaveBeenCalledWith({
        signer: mockSigner,
        url: URL,
        sha256: undefined,
        method: 'GET',
      });
    });

    it('forwards sha256 hint to the picker when provided', async () => {
      const { result } = renderHook(() => useAdultVerification());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.confirmAdult());

      const header = await result.current.getAuthHeader(URL, 'GET', HASH);
      expect(header).toBe('Nostr HEADER');
      expect(createMediaViewerAuthHeader).toHaveBeenCalledWith({
        signer: mockSigner,
        url: URL,
        sha256: HASH,
        method: 'GET',
      });
    });
  });

  describe('checkMediaAuth', () => {
    it('deduplicates concurrent checks and reuses short-lived cache for the same URL', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const url = 'https://media.divine.video/protected-video-cache-test';
      const [first, second] = await Promise.all([checkMediaAuth(url), checkMediaAuth(url)]);
      const third = await checkMediaAuth(url);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(first).toEqual({ authorized: false, status: 401 });
      expect(second).toEqual({ authorized: false, status: 401 });
      expect(third).toEqual({ authorized: false, status: 401 });
    });
  });
});
