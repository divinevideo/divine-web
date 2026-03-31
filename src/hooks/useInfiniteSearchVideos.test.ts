import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockNostrQuery = vi.fn();
const mockSearchVideos = vi.fn();
const mockTransformToVideoPage = vi.fn();
const mockParseVideoEvents = vi.fn();

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

vi.mock('@/hooks/useRelayCapabilities', () => ({
  useNIP50Support: () => true,
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: {
      relayUrl: 'wss://relay.divine.video',
    },
  }),
}));

vi.mock('@/lib/funnelcakeClient', () => ({
  searchVideos: mockSearchVideos,
}));

vi.mock('@/lib/funnelcakeTransform', () => ({
  transformToVideoPage: mockTransformToVideoPage,
}));

vi.mock('@/lib/videoParser', () => ({
  parseVideoEvents: mockParseVideoEvents,
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
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

describe('useInfiniteSearchVideos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses Funnelcake search results without falling back to relay search', async () => {
    const expectedVideos = [
      { id: 'video-1', pubkey: 'pubkey-1', createdAt: 123 } as const,
    ];

    mockSearchVideos.mockResolvedValue({
      videos: [],
      has_more: false,
    });
    mockTransformToVideoPage.mockReturnValue({
      videos: expectedVideos,
      nextCursor: undefined,
      hasMore: false,
    });

    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: 'jack', sortMode: 'relevance', pageSize: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockSearchVideos).toHaveBeenCalledWith(
      'https://api.divine.video',
      expect.objectContaining({
        query: 'jack',
        sort: 'trending',
        limit: 20,
        signal: expect.any(AbortSignal),
      })
    );
    expect(mockTransformToVideoPage).toHaveBeenCalled();
    expect(mockNostrQuery).not.toHaveBeenCalled();
    expect(result.current.data?.pages[0].videos).toEqual(expectedVideos);
  });

  it('falls back to relay search when Funnelcake search throws', async () => {
    const relayVideos = [
      { id: 'video-2', pubkey: 'pubkey-2', createdAt: 456 } as const,
    ];

    mockSearchVideos.mockRejectedValue(new Error('boom'));
    mockNostrQuery.mockResolvedValue([
      {
        id: 'event-1',
        pubkey: 'pubkey-2',
        kind: 34236,
        created_at: 456,
        tags: [['d', 'vine-1']],
        content: 'jack video',
        sig: 'sig',
      },
    ]);
    mockParseVideoEvents.mockReturnValue(relayVideos);

    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: 'jack', sortMode: 'hot', pageSize: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockSearchVideos).toHaveBeenCalled();
    expect(mockNostrQuery).toHaveBeenCalledTimes(1);
    expect(mockNostrQuery.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        kinds: [34236],
        limit: 20,
        search: 'sort:hot jack',
      }),
    ]);
    expect(mockNostrQuery.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
    expect(result.current.data?.pages[0].videos).toEqual(relayVideos);
  });
});

let useInfiniteSearchVideos: typeof import('./useInfiniteSearchVideos').useInfiniteSearchVideos;

beforeEach(async () => {
  ({ useInfiniteSearchVideos } = await import('./useInfiniteSearchVideos'));
});
