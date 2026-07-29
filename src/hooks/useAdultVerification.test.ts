import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdultVerification } from './useAdultVerification';
import { createMediaViewerAuthHeader } from '@/lib/mediaViewerAuth';
import { NOT_PROTECTED, UNKNOWN_PROTECTED_MINOR_STATUS, type ProtectedMinorStatus } from '@/lib/protectedMinor';

const mockSigner = { signEvent: vi.fn(), getPublicKey: vi.fn() };
let currentSigner: typeof mockSigner | null = mockSigner;

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ signer: currentSigner, pubkey: currentSigner ? 'pub' : null, user: currentSigner ? { pubkey: 'pub' } : null }),
}));

vi.mock('@/lib/mediaViewerAuth', () => ({
  createMediaViewerAuthHeader: vi.fn(),
}));

// Protected-minor lock (#453): default to a known not-protected session so the
// pre-existing behavior tests run unlocked; lock tests override per-case.
const PROTECTED: ProtectedMinorStatus = Object.freeze({
  state: 'protected' as const, isKnown: true, verifiedMinorAt: new Date('2026-05-01T00:00:00Z'),
});
let minorStatus: ProtectedMinorStatus = NOT_PROTECTED;
vi.mock('@/hooks/useProtectedMinorStatus', () => ({
  useProtectedMinorStatus: () => minorStatus,
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
    currentSigner = mockSigner;
    minorStatus = NOT_PROTECTED;
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

  it('does not treat stored adult confirmation as verified without a signer', async () => {
    currentSigner = null;
    window.localStorage.setItem('adult-verification-confirmed', 'true');
    window.localStorage.setItem('adult-verification-expiry', String(Date.now() + 60_000));

    const { result } = renderHook(() => useAdultVerification());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isVerified).toBe(false);
    expect(result.current.hasSigner).toBe(false);
  });

  describe('protected-minor lock (#453)', () => {
    const storeAttestation = () => {
      window.localStorage.setItem('adult-verification-confirmed', 'true');
      window.localStorage.setItem('adult-verification-expiry', String(Date.now() + 60_000));
    };

    it('is never verified for a protected minor, despite a valid stored attestation and signer', async () => {
      minorStatus = PROTECTED;
      storeAttestation();

      const { result } = renderHook(() => useAdultVerification());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isVerified).toBe(false);
    });

    it('purges a stale stored attestation once protection is known (self-heal)', async () => {
      minorStatus = PROTECTED;
      storeAttestation();

      const { result } = renderHook(() => useAdultVerification());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await waitFor(() => {
        expect(window.localStorage.getItem('adult-verification-confirmed')).toBeNull();
        expect(window.localStorage.getItem('adult-verification-expiry')).toBeNull();
      });
      expect(result.current.isVerified).toBe(false);
    });

    it('confirmAdult is a no-op for a protected minor', async () => {
      minorStatus = PROTECTED;

      const { result } = renderHook(() => useAdultVerification());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.confirmAdult();
      });

      expect(result.current.isVerified).toBe(false);
      expect(window.localStorage.getItem('adult-verification-confirmed')).toBeNull();
    });

    it('fails closed while the check is unknown: stays loading, no verification, no purge', async () => {
      minorStatus = UNKNOWN_PROTECTED_MINOR_STATUS;
      storeAttestation();

      const { result } = renderHook(() => useAdultVerification());

      // Unknown is exposed through isLoading and still fails closed for granting.
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isVerified).toBe(false);

      act(() => {
        result.current.confirmAdult();
      });
      expect(result.current.isVerified).toBe(false);

      // The adult's stored attestation must survive a transient unknown.
      expect(window.localStorage.getItem('adult-verification-confirmed')).toBe('true');
    });

    it('honors the stored attestation again once the check resolves not-protected', async () => {
      minorStatus = UNKNOWN_PROTECTED_MINOR_STATUS;
      storeAttestation();

      const { result, rerender } = renderHook(() => useAdultVerification());
      expect(result.current.isVerified).toBe(false);

      minorStatus = NOT_PROTECTED;
      rerender();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isVerified).toBe(true);
      });
    });

    it('locks and purges when protection resolves true after mount', async () => {
      storeAttestation();

      const { result, rerender } = renderHook(() => useAdultVerification());
      await waitFor(() => expect(result.current.isVerified).toBe(true));

      minorStatus = PROTECTED;
      rerender();

      await waitFor(() => {
        expect(result.current.isVerified).toBe(false);
        expect(window.localStorage.getItem('adult-verification-confirmed')).toBeNull();
      });
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
});
