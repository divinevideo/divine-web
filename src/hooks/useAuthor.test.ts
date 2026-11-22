// ABOUTME: Tests for useAuthor Funnelcake fallback and abort handling (#459)
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

let useAuthor: typeof import('./useAuthor').useAuthor;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  global.fetch = vi.fn();

  ({ useAuthor } = await import('./useAuthor'));

  mockIsFunnelcakeAvailable.mockReturnValue(true);
  mockNostrQuery.mockResolvedValue([]);
});

describe('useAuthor', () => {
  it('reports a fallback and queries the relay when the REST call fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('Server error'),
    });

    const { result } = renderHook(
      () => useAuthor('pubkey-1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockReportFunnelcakeFallback).toHaveBeenCalledWith(expect.objectContaining({
      source: 'useAuthor',
      reason: 'REST returned no profile',
    }));
    expect(mockNostrQuery).toHaveBeenCalledTimes(1);
  });

  it('rethrows AbortError from cancelled queries without reporting or falling back', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new DOMException('signal is aborted without reason', 'AbortError'),
    );

    renderHook(
      () => useAuthor('pubkey-1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(mockReportFunnelcakeFallback).not.toHaveBeenCalled();
    expect(mockRecordFunnelcakeFailure).not.toHaveBeenCalled();
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });

  it('reuses an in-flight batched author lookup instead of firing a duplicate GET', async () => {
    const { registerInFlightAuthorBatch } = await import('@/lib/batchedAuthorRegistry');
    registerInFlightAuthorBatch(
      ['pubkey-batched'],
      Promise.resolve({
        'pubkey-batched': {
          metadata: { name: 'Batched Alice', picture: 'https://example.com/a.jpg' },
        },
      }),
    );

    const { result } = renderHook(
      () => useAuthor('pubkey-batched'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.metadata?.name).toBe('Batched Alice');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });

  it('coalesces child useAuthor into parent useBatchedAuthors without firing individual GETs', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { useBatchedAuthors } = await import('./useBatchedAuthors');

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/users/bulk')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            users: [
              {
                pubkey: 'pubkey-parent-child',
                profile: { name: 'Coalesced Creator' },
              },
            ],
            missing: [],
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    function ChildCard() {
      const { data } = useAuthor('pubkey-parent-child');
      return React.createElement('span', null, data?.metadata?.name ?? 'loading');
    }

    function ParentFeed() {
      useBatchedAuthors(['pubkey-parent-child']);
      return React.createElement(ChildCard);
    }

    render(React.createElement(ParentFeed), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Coalesced Creator')).toBeTruthy();
    });

    const fetchUrls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map(([u]) => String(u));
    expect(fetchUrls.filter((u) => u.includes('/api/users/bulk'))).toHaveLength(1);
    expect(fetchUrls.filter((u) => u.includes('/api/users/pubkey-parent-child'))).toHaveLength(0);
  });
});
