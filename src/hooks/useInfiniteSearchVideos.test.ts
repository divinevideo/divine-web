import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockSearchVideos = vi.fn();
const mockNostrQuery = vi.fn();
const mockIsFunnelcakeAvailable = vi.fn();
const mockReportFunnelcakeFallback = vi.fn();

vi.mock('@/lib/funnelcakeClient', () => ({
  searchVideos: mockSearchVideos,
}));

vi.mock('@/config/api', () => ({
  API_CONFIG: {
    funnelcake: {
      baseUrl: 'https://funnelcake.example',
    },
  },
}));

vi.mock('@/lib/funnelcakeHealth', () => ({
  isFunnelcakeAvailable: mockIsFunnelcakeAvailable,
}));

vi.mock('@/lib/funnelcakeFallbackReporting', () => ({
  reportFunnelcakeFallback: mockReportFunnelcakeFallback,
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

vi.mock('@/lib/videoParser', () => ({
  parseVideoEvents: vi.fn().mockReturnValue([]),
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

let useInfiniteSearchVideos: typeof import('./useInfiniteSearchVideos').useInfiniteSearchVideos;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  const hook = await import('./useInfiniteSearchVideos');
  useInfiniteSearchVideos = hook.useInfiniteSearchVideos;

  mockIsFunnelcakeAvailable.mockReturnValue(true);
  mockSearchVideos.mockResolvedValue({
    videos: [],
    has_more: false,
    next_cursor: undefined,
  });
  mockNostrQuery.mockResolvedValue([]);
});

describe('useInfiniteSearchVideos', () => {
  it('skips Funnelcake REST for non-relevance text search and uses NIP-50 sorting', async () => {
    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: 'jack', sortMode: 'top', pageSize: 20 }),
      { wrapper: createWrapper(), initialProps: undefined }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockSearchVideos).not.toHaveBeenCalled();
    expect(mockNostrQuery).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          kinds: expect.any(Array),
          limit: 20,
          search: 'sort:top jack',
        }),
      ],
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(mockReportFunnelcakeFallback).not.toHaveBeenCalled();
  });
});
