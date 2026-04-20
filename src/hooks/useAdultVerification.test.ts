import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdultVerification } from './useAdultVerification';
import { createMediaViewerAuthHeader } from '@/lib/mediaViewerAuth';
import {
  ANONYMOUS_SIGNER_SK_KEY,
  ANONYMOUS_SIGNER_EXPIRY_KEY,
} from '@/lib/ephemeralSigner';

let mockSigner: { signEvent: ReturnType<typeof vi.fn>; getPublicKey: ReturnType<typeof vi.fn> } | null = {
  signEvent: vi.fn(),
  getPublicKey: vi.fn(),
};

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    signer: mockSigner,
    pubkey: mockSigner ? 'pub' : null,
    user: mockSigner ? { pubkey: 'pub' } : null,
  }),
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
    mockSigner = { signEvent: vi.fn(), getPublicKey: vi.fn() };
    vi.mocked(createMediaViewerAuthHeader).mockReset();
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

  describe('getAuthHeader (logged-in user)', () => {
    const HASH = 'a'.repeat(64);
    const URL = 'https://media.divine.video/file.mp4';

    beforeEach(() => {
      vi.mocked(createMediaViewerAuthHeader).mockResolvedValue('Nostr HEADER');
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

  describe('getAuthHeader (anonymous viewer)', () => {
    const URL = 'https://media.divine.video/file.mp4';

    beforeEach(() => {
      mockSigner = null; // no user signer
      vi.mocked(createMediaViewerAuthHeader).mockResolvedValue('Nostr HEADER');
    });

    it('uses an ephemeral signer after confirmAdult and persists the key', async () => {
      const { result } = renderHook(() => useAdultVerification());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.confirmAdult());
      await waitFor(() => expect(result.current.isVerified).toBe(true));

      const header = await result.current.getAuthHeader(URL);
      expect(header).toBe('Nostr HEADER');

      expect(createMediaViewerAuthHeader).toHaveBeenCalledTimes(1);
      const [input] = vi.mocked(createMediaViewerAuthHeader).mock.calls[0];
      expect(typeof input.signer!.getPublicKey).toBe('function');
      expect(typeof input.signer!.signEvent).toBe('function');
      expect(input.url).toBe(URL);
      expect(input.method).toBe('GET');

      expect(window.localStorage.getItem(ANONYMOUS_SIGNER_SK_KEY)).toMatch(/^[0-9a-f]{64}$/);
    });

    it('still returns null if the viewer has not confirmed adult content', async () => {
      const { result } = renderHook(() => useAdultVerification());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const header = await result.current.getAuthHeader(URL);
      expect(header).toBeNull();
      expect(createMediaViewerAuthHeader).not.toHaveBeenCalled();
    });

    it('revokeVerification clears the persisted ephemeral key', async () => {
      const { result } = renderHook(() => useAdultVerification());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.confirmAdult());
      await waitFor(() => expect(result.current.isVerified).toBe(true));

      await result.current.getAuthHeader(URL);
      expect(window.localStorage.getItem(ANONYMOUS_SIGNER_SK_KEY)).not.toBeNull();

      act(() => result.current.revokeVerification());
      await waitFor(() => expect(result.current.isVerified).toBe(false));

      expect(window.localStorage.getItem(ANONYMOUS_SIGNER_SK_KEY)).toBeNull();
      expect(window.localStorage.getItem(ANONYMOUS_SIGNER_EXPIRY_KEY)).toBeNull();
    });

    it('hasSigner is true once verified, even without a user signer', async () => {
      const { result } = renderHook(() => useAdultVerification());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasSigner).toBe(false);

      act(() => result.current.confirmAdult());
      await waitFor(() => expect(result.current.hasSigner).toBe(true));
    });
  });
});
