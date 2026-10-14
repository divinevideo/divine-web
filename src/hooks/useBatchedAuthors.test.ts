// ABOUTME: Tests for useBatchedAuthors Funnelcake fallback and abort handling (#459)
// ABOUTME: Cancelled queries must not be reported as fallbacks; genuine failures must be

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockNostrQuery = vi.fn();
const mockReportFunnelcakeFallback = vi.fn();
const mockIsFunnelcakeAvailable = vi.fn();
const mockRecordFunnelcakeFailure = vi.fn();
const mockRecordFunnelcakeSuccess = vi.fn();

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

vi.mock('@/lib/funnelcakeFallbackReporting', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/funnelcakeFallbackReporting')>()),
  reportFunnelcakeFallback: mockReportFunnelcakeFallback,
}));

vi.mock('@/lib/funnelcakeHealth', () => ({
  isFunnelcakeAvailable: mockIsFunnelcakeAvailable,
  recordFunnelcakeFailure: mockRecordFunnelcakeFailure,
  recordFunnelcakeSuccess: mockRecordFunnelcakeSuccess,
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

let useBatchedAuthors: typeof import('./useBatchedAuthors').useBatchedAuthors;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  global.fetch = vi.fn();

  ({ useBatchedAuthors } = await import('./useBatchedAuthors'));

  mockIsFunnelcakeAvailable.mockReturnValue(true);
  mockNostrQuery.mockResolvedValue([]);
});

describe('useBatchedAuthors', () => {
  it('reports a fallback and queries the relay when the REST call fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('Server error'),
    });

    const { result } = renderHook(
      () => useBatchedAuthors(['pubkey-1']),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockReportFunnelcakeFallback).toHaveBeenCalledWith(expect.objectContaining({
      source: 'useBatchedAuthors',
      reason: 'Funnelcake bulk users error: 500 Internal Server Error',
    }));
    expect(mockNostrQuery).toHaveBeenCalledTimes(1);
  });

  it('rethrows AbortError from cancelled queries without reporting or falling back', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new DOMException('signal is aborted without reason', 'AbortError'),
    );

    const { result } = renderHook(
      () => useBatchedAuthors(['pubkey-1']),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 3000 });

    expect(mockReportFunnelcakeFallback).not.toHaveBeenCalled();
    expect(mockRecordFunnelcakeFailure).not.toHaveBeenCalled();
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });
});
