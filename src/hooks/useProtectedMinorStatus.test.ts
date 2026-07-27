import { createElement, type ReactNode } from 'react';
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProtectedMinorStatus } from './useProtectedMinorStatus';

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

// A decodable JWT with a `sub` claim, so the sticky store (#180) keys on a
// stable account id. The existing tests use non-JWT tokens on purpose — their
// sub can't be decoded, so persistence is off and they test the live path only.
function makeJwt(sub: string): string {
  const b64url = (o: object) =>
    btoa(JSON.stringify(o))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64url({ alg: 'none' })}.${b64url({ sub })}.sig`;
}

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

describe('useProtectedMinorStatus', () => {
  beforeEach(() => {
    // This env doesn't provide localStorage; the #180 sticky store keys on it.
    // A fresh fake per test isolates the persisted verdict.
    vi.stubGlobal('localStorage', fakeStorage());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    focusManager.setFocused(undefined); // back to default focus tracking
  });

  it('is not protected and does not fetch when signed out', () => {
    mockUseDivineSession.mockReturnValue({ session: null });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useProtectedMinorStatus(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.state).toBe('not_protected');
    expect(result.current.isKnown).toBe(true);
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

    const { result } = renderHook(() => useProtectedMinorStatus(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.state).toBe('protected'));
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
    const { result, rerender } = renderHook(() => useProtectedMinorStatus(), {
      wrapper: makeWrapper(),
    });
    // Only protected once the 'minor' fetch actually resolves (not a default).
    await waitFor(() => expect(result.current.state).toBe('protected'));

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
    await waitFor(() => expect(result.current.state).toBe('not_protected'));
  });

  it('self-heals: a transient failure recovers on remount', async () => {
    // One wrapper (one shared QueryClient) reused across mount/unmount/remount,
    // using the app-global defaults — so recovery on remount can only happen
    // because the hook overrides staleTime to 0.
    const wrapper = makeWrapper();

    mockUseDivineSession.mockReturnValue({ session: { token: 'minor' } });

    // First mount: the fetch fails, so the status is explicitly unknown.
    const failing = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', failing);
    const first = renderHook(() => useProtectedMinorStatus(), { wrapper });
    await waitFor(() => expect(failing).toHaveBeenCalled());
    expect(first.result.current.state).toBe('unknown');
    expect(first.result.current.isKnown).toBe(false);
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
    const second = renderHook(() => useProtectedMinorStatus(), { wrapper });
    await waitFor(() => expect(second.result.current.state).toBe('protected'));
  });

  it('is unknown when the fetch fails for an authenticated session', async () => {
    mockUseDivineSession.mockReturnValue({ session: { token: 'tok' } });
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useProtectedMinorStatus(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.state).toBe('unknown');
    expect(result.current.isKnown).toBe(false);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(result.current.state).toBe('unknown');
  });

  it('#180: a stored protected verdict survives a later refetch that resolves to unknown', async () => {
    focusManager.setFocused(true);
    const token = makeJwt('minorpubkeyhex');
    mockUseDivineSession.mockReturnValue({ session: { token } });

    // First load succeeds -> protected -> persisted to the sticky store.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ verified_minor: true }),
      }),
    );
    const { result } = renderHook(() => useProtectedMinorStatus(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.state).toBe('protected'));

    // A focus refetch now fails; queryFn resolves to `unknown` and React Query
    // writes it over the prior protected. WITHOUT the sticky store this fails
    // open; WITH it, the hook falls back to the stored protected.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    focusManager.setFocused(false);
    focusManager.setFocused(true);

    // The refetch runs; the effective status must remain protected.
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.state).toBe('protected');
  });

  it('#180: an unknown check with no prior verdict fails closed (stays unknown)', async () => {
    const token = makeJwt('freshpubkeyhex');
    mockUseDivineSession.mockReturnValue({ session: { token } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { result } = renderHook(() => useProtectedMinorStatus(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() =>
      expect((globalThis.fetch as ReturnType<typeof vi.fn>)).toHaveBeenCalled(),
    );
    expect(result.current.state).toBe('unknown');
  });

  it('self-heals on window focus (refetchOnWindowFocus override)', async () => {
    focusManager.setFocused(true);
    mockUseDivineSession.mockReturnValue({ session: { token: 'minor' } });

    // First load fails, so the explicit unknown state is cached under the key.
    const failing = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', failing);
    const { result } = renderHook(() => useProtectedMinorStatus(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(failing).toHaveBeenCalled());
    expect(result.current.state).toBe('unknown');

    // The fetch now succeeds. Regaining window focus must trigger a refetch —
    // which only happens because the hook sets refetchOnWindowFocus:true (the
    // wrapper default, mirroring the app, is false). No remount here.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ verified_minor: true }),
      }),
    );
    focusManager.setFocused(false);
    focusManager.setFocused(true);

    await waitFor(() => expect(result.current.state).toBe('protected'));
  });
});
