// ABOUTME: Tests for useAuthor Funnelcake fallback and abort handling (#459)
// ABOUTME: Cancelled queries must not be reported as fallbacks; genuine failures must be

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockFetchUserProfile = vi.fn();
const mockNostrQuery = vi.fn();
const mockReportFunnelcakeFallback = vi.fn();
const mockIsFunnelcakeAvailable = vi.fn();

vi.mock('@/lib/funnelcakeClient', () => ({
  fetchUserProfile: mockFetchUserProfile,
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

vi.mock('@/lib/eventCache', () => ({
  eventCache: {
    event: vi.fn().mockResolvedValue(undefined),
  },
  CACHE_TTL: {
    PROFILE: 60_000,
  },
}));

vi.mock('@/lib/funnelcakeFallbackReporting', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/funnelcakeFallbackReporting')>()),
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

let useAuthor: typeof import('./useAuthor').useAuthor;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  ({ useAuthor } = await import('./useAuthor'));

  mockIsFunnelcakeAvailable.mockReturnValue(true);
  mockNostrQuery.mockResolvedValue([]);
});

describe('useAuthor', () => {
  it('reports a fallback and queries the relay when the REST call fails', async () => {
    mockFetchUserProfile.mockRejectedValue(new Error('Funnelcake API error: 500 Internal Server Error'));

    const { result } = renderHook(
      () => useAuthor('pubkey-1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockReportFunnelcakeFallback).toHaveBeenCalledWith(expect.objectContaining({
      source: 'useAuthor',
      reason: 'Funnelcake API error: 500 Internal Server Error',
    }));
    expect(mockNostrQuery).toHaveBeenCalledTimes(1);
  });

  it('rethrows AbortError from cancelled queries without reporting or falling back', async () => {
    mockFetchUserProfile.mockRejectedValue(
      new DOMException('signal is aborted without reason', 'AbortError'),
    );

    const { result } = renderHook(
      () => useAuthor('pubkey-1'),
      { wrapper: createWrapper() }
    );

    // useAuthor sets retry: 2, so wait for the first attempt instead of final error state
    await waitFor(() => {
      expect(mockFetchUserProfile).toHaveBeenCalled();
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockReportFunnelcakeFallback).not.toHaveBeenCalled();
    expect(mockNostrQuery).not.toHaveBeenCalled();

    expect(result.current.isSuccess).toBe(false);
  });
});
