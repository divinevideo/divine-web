import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import type { NostrEvent } from '@nostrify/nostrify';
import type { ParsedVideoData } from '@/types/video';

const mockNostrQuery = vi.fn();
const mockSearchVideos = vi.fn();
const mockSearchProfiles = vi.fn();
const mockTransformToVideoPage = vi.fn();
const mockParseVideoEvents = vi.fn();
const mockReportFunnelcakeFallback = vi.fn();
const mockIsFunnelcakeAvailable = vi.fn();

vi.mock('@/lib/funnelcakeFallbackReporting', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/funnelcakeFallbackReporting')>()),
  reportFunnelcakeFallback: mockReportFunnelcakeFallback,
}));

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
  searchProfiles: mockSearchProfiles,
}));

vi.mock('@/lib/funnelcakeTransform', () => ({
  transformToVideoPage: mockTransformToVideoPage,
}));

vi.mock('@/lib/funnelcakeHealth', () => ({
  isFunnelcakeAvailable: mockIsFunnelcakeAvailable,
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

function makeHex(index: number, length: number): string {
  return index.toString(16).padStart(length, '0');
}

function makeEvent(index: number, createdAt = 1700000000 - index): NostrEvent {
  return {
    id: makeHex(index, 64),
    pubkey: makeHex(1000 + index, 64),
    created_at: createdAt,
    kind: 34236,
    tags: [['d', `vine-${index}`]],
    content: '',
    sig: makeHex(2000 + index, 128),
  };
}

function makeVideo(index: number, overrides: Partial<ParsedVideoData> = {}): ParsedVideoData {
  return {
    id: makeEvent(index).id,
    pubkey: makeEvent(index).pubkey,
    kind: 34236,
    createdAt: 1700000000 - index,
    content: '',
    videoUrl: `https://example.com/video-${index}.mp4`,
    hashtags: [],
    vineId: `vine-${index}`,
    isVineMigrated: false,
    reposts: [],
    ...overrides,
  };
}

describe('useInfiniteSearchVideos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFunnelcakeAvailable.mockReturnValue(true);
  });

  it('uses Funnelcake search results without falling back to relay search', async () => {
    const expectedVideos = [
      makeVideo(101, { createdAt: 123 }),
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

  it('returns empty results for URL-like queries without calling the API', async () => {
    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: 'https://vine.co/v/hAgW0mP5zKL//', sortMode: 'relevance', pageSize: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockSearchVideos).not.toHaveBeenCalled();
    expect(mockNostrQuery).not.toHaveBeenCalled();
    expect(result.current.data?.pages[0].videos).toEqual([]);
  });

  it('returns empty results for scheme-less Vine URLs without calling the API', async () => {
    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: 'vine.co/v/hAgW0mP5zKL', sortMode: 'relevance', pageSize: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockSearchVideos).not.toHaveBeenCalled();
    expect(mockNostrQuery).not.toHaveBeenCalled();
    expect(result.current.data?.pages[0].videos).toEqual([]);
  });

  it('falls back to relay search when Funnelcake search throws', async () => {
    const relayVideos = [
      makeVideo(102, { createdAt: 456 }),
    ];

    mockSearchVideos.mockRejectedValue(new Error('boom'));
    mockNostrQuery.mockResolvedValue([
      makeEvent(102, 456),
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

  it('rethrows AbortError from cancelled queries without reporting or falling back', async () => {
    mockSearchVideos.mockRejectedValue(
      new DOMException('signal is aborted without reason', 'AbortError'),
    );

    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: 'jack', sortMode: 'relevance', pageSize: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 3000 });

    expect(mockReportFunnelcakeFallback).not.toHaveBeenCalled();
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });

  it('backfills hashtag fallback when a full raw page parses to zero videos', async () => {
    mockIsFunnelcakeAvailable.mockReturnValue(false);
    mockNostrQuery
      .mockResolvedValueOnce([
        makeEvent(1, 100),
        makeEvent(2, 99),
      ])
      .mockResolvedValueOnce([makeEvent(3, 80)]);
    mockParseVideoEvents
      .mockReturnValueOnce([])
      .mockReturnValueOnce([makeVideo(3)]);

    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: '#vine', sortMode: 'relevance', pageSize: 2 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNostrQuery).toHaveBeenCalledTimes(2);
    expect(mockNostrQuery.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ '#t': ['vine'], limit: 2 }),
    ]);
    expect(mockNostrQuery.mock.calls[1]?.[0]).toEqual([
      expect.objectContaining({ '#t': ['vine'], limit: 2, until: 98 }),
    ]);
    expect(result.current.data?.pages[0].videos).toEqual([makeVideo(3)]);
  });

  it('advances hashtag fallback from the raw tail when a page parses short', async () => {
    mockIsFunnelcakeAvailable.mockReturnValue(false);
    mockNostrQuery
      .mockResolvedValueOnce([
        makeEvent(1, 100),
        makeEvent(2, 90),
      ])
      .mockResolvedValueOnce([makeEvent(3, 70)]);
    mockParseVideoEvents
      .mockReturnValueOnce([makeVideo(1, { createdAt: 100 })])
      .mockReturnValueOnce([makeVideo(3, { createdAt: 70 })]);

    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: '#vine', sortMode: 'relevance', pageSize: 2 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(mockNostrQuery.mock.calls[1]?.[0]).toEqual([
      expect.objectContaining({ '#t': ['vine'], limit: 2, until: 89 }),
    ]);
  });

  it('backfills author fallback when a full raw page parses to zero videos', async () => {
    mockSearchProfiles.mockResolvedValue([{ pubkey: 'a'.repeat(64) }]);
    mockNostrQuery
      .mockResolvedValueOnce([
        makeEvent(1, 100),
        makeEvent(2, 99),
      ])
      .mockResolvedValueOnce([makeEvent(3, 80)]);
    mockParseVideoEvents
      .mockReturnValueOnce([])
      .mockReturnValueOnce([makeVideo(3)]);

    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: 'alice', searchType: 'author', sortMode: 'relevance', pageSize: 2 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNostrQuery).toHaveBeenCalledTimes(2);
    expect(mockNostrQuery.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ authors: ['a'.repeat(64)], limit: 2 }),
    ]);
    expect(mockNostrQuery.mock.calls[1]?.[0]).toEqual([
      expect.objectContaining({ authors: ['a'.repeat(64)], limit: 2, until: 98 }),
    ]);
    expect(result.current.data?.pages[0].videos).toEqual([makeVideo(3)]);
  });

  it('advances author fallback from the raw tail when a page parses short', async () => {
    mockSearchProfiles.mockResolvedValue([{ pubkey: 'a'.repeat(64) }]);
    mockNostrQuery
      .mockResolvedValueOnce([
        makeEvent(1, 100),
        makeEvent(2, 90),
      ])
      .mockResolvedValueOnce([makeEvent(3, 70)]);
    mockParseVideoEvents
      .mockReturnValueOnce([makeVideo(1, { createdAt: 100 })])
      .mockReturnValueOnce([makeVideo(3, { createdAt: 70 })]);

    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: 'alice', searchType: 'author', sortMode: 'relevance', pageSize: 2 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(mockNostrQuery.mock.calls[1]?.[0]).toEqual([
      expect.objectContaining({ authors: ['a'.repeat(64)], limit: 2, until: 89 }),
    ]);
  });

  it('paginates content fallback with a ranked raw window instead of until', async () => {
    mockSearchVideos.mockRejectedValue(new Error('boom'));
    const firstPageEvents = [makeEvent(1, 100), makeEvent(2, 90)];
    const secondPrefixEvents = [
      makeEvent(1, 100),
      makeEvent(2, 90),
      makeEvent(3, 80),
      makeEvent(4, 70),
    ];
    mockNostrQuery
      .mockResolvedValueOnce(firstPageEvents)
      .mockResolvedValueOnce(secondPrefixEvents);
    mockParseVideoEvents
      .mockReturnValueOnce([makeVideo(1), makeVideo(2)])
      .mockReturnValueOnce([makeVideo(3), makeVideo(4)]);

    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: 'jack', sortMode: 'relevance', pageSize: 2 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(mockNostrQuery.mock.calls.map(call => call[0][0])).toEqual([
      expect.objectContaining({ search: 'jack', limit: 2 }),
      expect.objectContaining({ search: 'jack', limit: 4 }),
    ]);
    expect(mockNostrQuery.mock.calls[0]?.[0][0]).not.toHaveProperty('until');
    expect(mockNostrQuery.mock.calls[1]?.[0][0]).not.toHaveProperty('until');
    expect(mockParseVideoEvents.mock.calls[1]?.[0].map((event: NostrEvent) => event.id)).toEqual([
      makeEvent(3).id,
      makeEvent(4).id,
    ]);
  });

  it('expands ranked content fallback before stopping after backfill exhaustion', async () => {
    mockSearchVideos.mockRejectedValue(new Error('boom'));
    mockNostrQuery
      .mockResolvedValueOnce([makeEvent(1), makeEvent(2)])
      .mockResolvedValueOnce([makeEvent(1), makeEvent(2), makeEvent(3), makeEvent(4)])
      .mockResolvedValueOnce([makeEvent(1), makeEvent(2), makeEvent(3), makeEvent(4), makeEvent(5), makeEvent(6)]);
    mockParseVideoEvents
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);

    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: 'jack', sortMode: 'hot', pageSize: 2 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNostrQuery).toHaveBeenCalledTimes(3);
    expect(mockNostrQuery.mock.calls.map(call => call[0][0].limit)).toEqual([2, 4, 6]);
    expect(result.current.data?.pages[0].videos).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('stops ranked content fallback when the relay returns fewer raw events than requested', async () => {
    mockSearchVideos.mockRejectedValue(new Error('boom'));
    mockNostrQuery.mockResolvedValueOnce([makeEvent(1)]);
    mockParseVideoEvents.mockReturnValueOnce([]);

    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: 'jack', sortMode: 'relevance', pageSize: 2 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNostrQuery).toHaveBeenCalledTimes(1);
    expect(mockNostrQuery.mock.calls[0]?.[0][0]).toEqual(
      expect.objectContaining({ search: 'jack', limit: 2 })
    );
    expect(result.current.data?.pages[0].videos).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('does not carry a Funnelcake offset into ranked relay fallback', async () => {
    mockSearchVideos
      .mockResolvedValueOnce({ videos: [], has_more: true })
      .mockRejectedValueOnce(new Error('boom'));
    mockTransformToVideoPage.mockReturnValueOnce({
      videos: [makeVideo(1)],
      offset: 12,
      hasMore: true,
    });
    mockNostrQuery.mockResolvedValueOnce([
      makeEvent(1),
      makeEvent(2),
    ]);
    mockParseVideoEvents.mockReturnValueOnce([makeVideo(1), makeVideo(2)]);

    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: 'jack', sortMode: 'relevance', pageSize: 2 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(mockNostrQuery.mock.calls[0]?.[0][0]).toEqual(
      expect.objectContaining({ search: 'jack', limit: 2 })
    );
    expect(mockNostrQuery.mock.calls[0]?.[0][0]).not.toHaveProperty('until');
  });

  it('does not pass an author timestamp cursor into ranked relay fallback', async () => {
    mockSearchProfiles
      .mockResolvedValueOnce([{ pubkey: 'a'.repeat(64) }])
      .mockRejectedValueOnce(new Error('boom'));
    mockNostrQuery
      .mockResolvedValueOnce([
        makeEvent(1, 100),
        makeEvent(2, 90),
      ])
      .mockResolvedValueOnce([
        makeEvent(3, 80),
        makeEvent(4, 70),
      ]);
    mockParseVideoEvents
      .mockReturnValueOnce([makeVideo(1, { createdAt: 100 })])
      .mockReturnValueOnce([makeVideo(3, { createdAt: 80 }), makeVideo(4, { createdAt: 70 })]);

    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: 'alice', searchType: 'author', sortMode: 'relevance', pageSize: 2 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(mockNostrQuery.mock.calls[1]?.[0][0]).toEqual(
      expect.objectContaining({ search: 'alice', limit: 2 })
    );
    expect(mockNostrQuery.mock.calls[1]?.[0][0]).not.toHaveProperty('until');
  });

  it('keeps paging the ranked window after author fallback instead of rewinding', async () => {
    mockSearchProfiles
      .mockResolvedValueOnce([{ pubkey: 'a'.repeat(64) }])
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue([{ pubkey: 'a'.repeat(64) }]);
    mockNostrQuery
      .mockResolvedValueOnce([
        makeEvent(1, 100),
        makeEvent(2, 90),
      ])
      .mockResolvedValueOnce([
        makeEvent(3, 80),
        makeEvent(4, 70),
      ])
      .mockResolvedValueOnce([
        makeEvent(3, 80),
        makeEvent(4, 70),
        makeEvent(5, 60),
        makeEvent(6, 50),
      ]);
    mockParseVideoEvents
      .mockReturnValueOnce([makeVideo(1, { createdAt: 100 })])
      .mockReturnValueOnce([makeVideo(3, { createdAt: 80 }), makeVideo(4, { createdAt: 70 })])
      .mockReturnValueOnce([makeVideo(5, { createdAt: 60 }), makeVideo(6, { createdAt: 50 })]);

    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: 'alice', searchType: 'author', sortMode: 'relevance', pageSize: 2 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    // Once author search falls over to the ranked window it stays there: no third
    // profile lookup, and the window grows instead of restarting the author feed.
    expect(mockSearchProfiles).toHaveBeenCalledTimes(2);
    expect(mockNostrQuery.mock.calls[2]?.[0][0]).toEqual(
      expect.objectContaining({ search: 'alice', limit: 4 })
    );
    expect(mockNostrQuery.mock.calls[2]?.[0][0]).not.toHaveProperty('until');
    expect(mockParseVideoEvents.mock.calls[2]?.[0].map((event: NostrEvent) => event.id)).toEqual([
      makeEvent(5).id,
      makeEvent(6).id,
    ]);
  });

  it('stops pagination when Funnelcake returns a non-numeric offset cursor', async () => {
    mockSearchVideos.mockResolvedValueOnce({ videos: [], has_more: true });
    mockTransformToVideoPage.mockReturnValueOnce({
      videos: [makeVideo(1)],
      offset: NaN,
      hasMore: true,
    });

    const { result } = renderHook(
      () => useInfiniteSearchVideos({ query: 'jack', sortMode: 'relevance', pageSize: 2 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.hasNextPage).toBe(false);
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });
});

let useInfiniteSearchVideos: typeof import('./useInfiniteSearchVideos').useInfiniteSearchVideos;

beforeEach(async () => {
  ({ useInfiniteSearchVideos } = await import('./useInfiniteSearchVideos'));
});
