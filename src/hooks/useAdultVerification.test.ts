import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdultVerification } from './useAdultVerification';

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ signer: null, user: null }),
}));

vi.mock('@/lib/nip98Auth', () => ({
  createNip98AuthHeader: vi.fn(),
}));

describe('useAdultVerification', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
    });
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
});
