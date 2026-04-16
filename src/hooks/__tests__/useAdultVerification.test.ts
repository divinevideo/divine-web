import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/lib/mediaViewerAuth', () => ({
  createMediaViewerAuthHeader: vi.fn(),
}));

const mockSigner = { signEvent: vi.fn(), getPublicKey: vi.fn() };
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ signer: mockSigner, pubkey: 'pub', user: { pubkey: 'pub' } }),
}));

import { createMediaViewerAuthHeader } from '@/lib/mediaViewerAuth';
import { useAdultVerification } from '@/hooks/useAdultVerification';

const HASH = 'a'.repeat(64);
const URL = 'https://media.divine.video/file.mp4';

/** jsdom may not implement localStorage; provide a minimal in-memory fallback. */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
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
  };
}

describe('useAdultVerification.getAuthHeader', () => {
  beforeEach(() => {
    if (typeof localStorage?.clear !== 'function') {
      vi.stubGlobal('localStorage', createMemoryStorage());
    } else {
      localStorage.clear();
    }
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
