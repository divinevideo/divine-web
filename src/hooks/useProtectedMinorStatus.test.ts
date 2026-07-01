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

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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

  it('refetches and updates when the session token changes (no cross-user leak)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, opts?: RequestInit) => {
        const auth = (opts?.headers as Record<string, string> | undefined)
          ?.Authorization;
        return {
          ok: true,
          status: 200,
          json: async () => ({ verified_minor: auth === 'Bearer minor' }),
        };
      }),
    );

    mockUseDivineSession.mockReturnValue({ session: { token: 'minor' } });
    const { result, rerender } = renderHook(() => useIsProtectedMinor(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current).toBe(true));

    mockUseDivineSession.mockReturnValue({ session: { token: 'adult' } });
    rerender();
    await waitFor(() => expect(result.current).toBe(false));
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
