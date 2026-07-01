import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useIsProtectedMinor,
  useProtectedMinorStatus,
} from './useProtectedMinorStatus';

const mockUseDivineSession = vi.fn();
vi.mock('@/hooks/useDivineSession', () => ({
  useDivineSession: () => mockUseDivineSession(),
}));

// Mirror the app-global QueryClient defaults (src/App.tsx) so these tests only
// pass BECAUSE the hook overrides staleTime/refetchOnWindowFocus. If the hook
// dropped those overrides, the self-heal/refetch tests would fail here instead
// of silently passing on React Query's permissive library defaults.
function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useProtectedMinorStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('is not protected and does not fetch when signed out', () => {
    mockUseDivineSession.mockReturnValue({ session: null });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useProtectedMinorStatus(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isProtectedMinor).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('is protected when an authenticated session reports verified_minor', async () => {
    mockUseDivineSession.mockReturnValue({ session: { token: 'tok123' } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          verified_minor: true,
          verified_minor_at: '2026-06-30T12:00:00Z',
        }),
      }),
    );

    const { result } = renderHook(() => useIsProtectedMinor(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('refetches with the new token on account switch (no cross-user leak)', async () => {
    const fetchMock = vi.fn(async (_url: string, opts?: RequestInit) => {
      const auth = (opts?.headers as Record<string, string> | undefined)
        ?.Authorization;
      return {
        ok: true,
        status: 200,
        json: async () => ({ verified_minor: auth === 'Bearer minor' }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    mockUseDivineSession.mockReturnValue({ session: { token: 'minor' } });
    const { result, rerender } = renderHook(() => useIsProtectedMinor(), {
      wrapper: makeWrapper(),
    });
    // Only true once the 'minor' fetch actually resolves (not a default).
    await waitFor(() => expect(result.current).toBe(true));

    mockUseDivineSession.mockReturnValue({ session: { token: 'adult' } });
    rerender();
    // Prove the new token was fetched (refetch + isolation), not just the
    // key-change transient, then that it resolves to not-protected.
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer adult' }),
        }),
      ),
    );
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('self-heals: a transient failure recovers on remount', async () => {
    // One wrapper (one shared QueryClient) reused across mount/unmount/remount,
    // using the app-global defaults — so recovery on remount can only happen
    // because the hook overrides staleTime to 0.
    const wrapper = makeWrapper();

    mockUseDivineSession.mockReturnValue({ session: { token: 'minor' } });

    // First mount: the fetch fails, so the flag reads not-protected.
    const failing = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', failing);
    const first = renderHook(() => useIsProtectedMinor(), { wrapper });
    await waitFor(() => expect(failing).toHaveBeenCalled());
    expect(first.result.current).toBe(false);
    first.unmount();

    // Recovery: the fetch now succeeds; because staleTime is 0 the remount
    // refetches instead of serving the stale not-protected value.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ verified_minor: true }),
      }),
    );
    const second = renderHook(() => useIsProtectedMinor(), { wrapper });
    await waitFor(() => expect(second.result.current).toBe(true));
  });

  it('stays not protected when the fetch fails for an authenticated session', async () => {
    mockUseDivineSession.mockReturnValue({ session: { token: 'tok' } });
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useIsProtectedMinor(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
