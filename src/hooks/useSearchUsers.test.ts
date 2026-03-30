import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockSearchProfiles = vi.fn();
const mockNostrQuery = vi.fn();
const mockReportFunnelcakeFallback = vi.fn();
const mockIsFunnelcakeAvailable = vi.fn();

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

vi.mock('@/lib/funnelcakeFallbackReporting', () => ({
  reportFunnelcakeFallback: mockReportFunnelcakeFallback,
}));

vi.mock('@/lib/funnelcakeHealth', () => ({
  isFunnelcakeAvailable: mockIsFunnelcakeAvailable,
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
  it('uses the configured Funnelcake API URL and falls back on timeout', async () => {
    mockSearchProfiles.mockRejectedValue(new DOMException('signal timed out', 'TimeoutError'));
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
      expect(result.current.isSuccess).toBe(true);
    }, { timeout: 3000 });
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
});
