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
});
