import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockSearchProfiles = vi.fn();
const mockNostrQuery = vi.fn();
<<<<<<< HEAD
const mockReportFunnelcakeFallback = vi.fn();
const mockIsFunnelcakeAvailable = vi.fn();
=======
const mockAddBreadcrumb = vi.fn();
const mockCaptureException = vi.fn();
const mockCaptureNonFatalError = vi.fn();
>>>>>>> 70a78d6 (Fix search user fallback test mock)

vi.mock('@/lib/funnelcakeClient', () => ({
  searchProfiles: mockSearchProfiles,
}));

vi.mock('@/config/api', () => ({
  API_CONFIG: {
    funnelcake: {
      baseUrl: 'https://funnelcake.example',
    },
  },
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

<<<<<<< HEAD
vi.mock('@/lib/funnelcakeFallbackReporting', () => ({
  reportFunnelcakeFallback: mockReportFunnelcakeFallback,
}));

vi.mock('@/lib/funnelcakeHealth', () => ({
  isFunnelcakeAvailable: mockIsFunnelcakeAvailable,
=======
vi.mock('@/lib/sentry', () => ({
  addBreadcrumb: mockAddBreadcrumb,
  captureException: mockCaptureException,
  captureNonFatalError: mockCaptureNonFatalError,
>>>>>>> 70a78d6 (Fix search user fallback test mock)
}));

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createAbortableSearchPromise() {
  return new Promise<never>((_, reject) => {
    // The hook should always pass a signal for Funnelcake profile search.
    const signal = mockSearchProfiles.mock.calls.at(-1)?.[1]?.signal as AbortSignal | undefined;
    if (!signal) return;

    const rejectOnAbort = () => {
      const reason = signal.reason;
      reject(reason instanceof Error ? reason : new Error('aborted'));
    };

    if (signal.aborted) {
      rejectOnAbort();
      return;
    }

    signal.addEventListener('abort', rejectOnAbort, { once: true });
  });
}

let useSearchUsers: typeof import('./useSearchUsers').useSearchUsers;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  const hook = await import('./useSearchUsers');
  useSearchUsers = hook.useSearchUsers;

  mockIsFunnelcakeAvailable.mockReturnValue(true);
  mockNostrQuery.mockResolvedValue([]);
});

describe('useSearchUsers', () => {
  it('uses the configured Funnelcake API URL and falls back quickly on timeout', async () => {
    mockSearchProfiles.mockImplementation(() => createAbortableSearchPromise());
    mockNostrQuery.mockResolvedValue([
      {
        pubkey: 'relay-user',
        content: JSON.stringify({
          name: 'jack',
          display_name: 'Jack Relay',
        }),
      },
    ]);

    const startTime = Date.now();
    const { result } = renderHook(
      () => useSearchUsers({ query: 'jack', limit: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    }, { timeout: 2500 });

    const elapsedMs = Date.now() - startTime;

    expect(elapsedMs).toBeLessThan(2500);
    expect(mockSearchProfiles).toHaveBeenCalledWith(
      'https://funnelcake.example',
      expect.objectContaining({
        query: 'jack',
        limit: 20,
        sortBy: 'relevance',
        signal: expect.any(AbortSignal),
      }),
    );
    expect(mockNostrQuery).toHaveBeenCalledTimes(1);
    expect(mockReportFunnelcakeFallback).toHaveBeenCalledWith(expect.objectContaining({
      apiUrl: 'https://funnelcake.example',
      reason: expect.stringMatching(/aborted|timeout/i),
    }));
    expect(result.current.data).toEqual([
      {
        pubkey: 'relay-user',
        metadata: {
          name: 'jack',
          display_name: 'Jack Relay',
        },
      },
    ]);
  });

  it('skips Funnelcake entirely when the circuit breaker marks it unavailable', async () => {
    mockIsFunnelcakeAvailable.mockReturnValue(false);
    mockNostrQuery.mockResolvedValue([
      {
        pubkey: 'relay-user',
        content: JSON.stringify({
          name: 'jack',
        }),
      },
    ]);

    const { result } = renderHook(
      () => useSearchUsers({ query: 'jack', limit: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockSearchProfiles).not.toHaveBeenCalled();
    expect(mockReportFunnelcakeFallback).toHaveBeenCalledWith(expect.objectContaining({
      apiUrl: 'https://funnelcake.example',
      reason: 'Funnelcake unavailable or circuit breaker open',
    }));
    expect(result.current.data).toEqual([
      {
        pubkey: 'relay-user',
        metadata: {
          name: 'jack',
        },
      },
    ]);
  });

  it('filters suspicious results and prefers profiles with real signal', async () => {
    mockSearchProfiles.mockResolvedValue([
      {
        pubkey: 'high-signal',
        name: 'jack',
        display_name: 'Jack',
        nip05: '_@jack.divine.video',
        about: '',
        picture: 'https://media.divine.video/avatar.png',
        banner: '',
        follower_count: 0,
        video_count: 21,
      },
      {
        pubkey: 'suspicious',
        name: 'Jack',
        display_name: '',
        nip05: '',
        about: '<script>alert("jack")</script>',
        picture: 'https://iplogger.com/tracker.jpg',
        banner: '',
        follower_count: 0,
        video_count: 0,
      },
      {
        pubkey: 'low-signal',
        name: 'jack',
        display_name: '',
        nip05: '',
        about: '',
        picture: '',
        banner: '',
        follower_count: 0,
        video_count: 0,
      },
      {
        pubkey: 'real-user',
        name: 'jack',
        display_name: 'jack',
        nip05: 'j4ck.xyz',
        about: 'a quick bio because why not eh?',
        picture: 'https://m.primal.net/NJpr.jpg',
        banner: '',
        follower_count: 17,
        video_count: 0,
      },
    ]);

    const { result } = renderHook(
      () => useSearchUsers({ query: 'jack', limit: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const pubkeys = result.current.data?.map(user => user.pubkey) ?? [];

    expect(pubkeys).toEqual(['high-signal', 'real-user']);
    expect(pubkeys).not.toContain('suspicious');
    expect(pubkeys).not.toContain('low-signal');
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });

  it('falls back to relay search when profile search fails', async () => {
    mockSearchProfiles.mockRejectedValue(new Error('profile search failed'));
    mockNostrQuery.mockResolvedValue([
      {
        pubkey: 'relay-user',
        content: JSON.stringify({
          name: 'jack',
          display_name: 'Jack Relay',
        }),
      },
    ]);

    const { result } = renderHook(
      () => useSearchUsers({ query: 'jack', limit: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(mockNostrQuery).toHaveBeenCalledTimes(1);
    }, { timeout: 5000 });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual([
        {
          pubkey: 'relay-user',
          metadata: {
            name: 'jack',
            display_name: 'Jack Relay',
          },
        },
      ]);
    }, { timeout: 5000 });

    expect(mockReportFunnelcakeFallback).toHaveBeenCalledWith(expect.objectContaining({
      apiUrl: 'https://funnelcake.example',
      reason: 'profile search failed',
    }));
  }, 10000);
});
