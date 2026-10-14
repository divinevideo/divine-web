import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NostrEvent } from '@nostrify/nostrify';
import type { ParsedVideoData } from '@/types/video';

const mockNostrQuery = vi.fn();
const mockParseVideoEvents = vi.fn();

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: 'a'.repeat(64) },
  }),
}));

vi.mock('@/hooks/useFollowList', () => ({
  useFollowList: () => ({
    data: ['b'.repeat(64)],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: {
      relayUrl: 'wss://relay.divine.video',
    },
  }),
}));

vi.mock('@/hooks/useRelayCapabilities', () => ({
  useVideoSortSupport: () => true,
}));

vi.mock('@/lib/videoParser', () => ({
  parseVideoEvents: mockParseVideoEvents,
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

vi.mock('@/lib/performanceMonitoring', () => ({
  performanceMonitor: {
    recordQuery: vi.fn(),
    recordFeedLoad: vi.fn(),
  },
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

function makeEvent(index: number, createdAt = 1700000000 - index): NostrEvent {
  return {
    id: `event-${String(index).padStart(2, '0')}`,
    pubkey: `pubkey-${String(index).padStart(2, '0')}`,
    created_at: createdAt,
    kind: 34236,
    tags: [['d', `vine-${index}`]],
    content: '',
    sig: 'sig',
  };
}

function makeEvents(count: number, startIndex = 0): NostrEvent[] {
  return Array.from({ length: count }, (_, index) => makeEvent(startIndex + index));
}

function makeVideo(index: number, overrides: Partial<ParsedVideoData> = {}): ParsedVideoData {
  return {
    id: `event-${String(index).padStart(2, '0')}`,
    pubkey: `pubkey-${String(index).padStart(2, '0')}`,
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

let useInfiniteVideos: typeof import('./useInfiniteVideos').useInfiniteVideos;

beforeEach(async () => {
  vi.clearAllMocks();
  ({ useInfiniteVideos } = await import('./useInfiniteVideos'));
});

describe('useInfiniteVideos sorted relay pagination', () => {
  it('continues when a full raw page parses short', async () => {
    mockNostrQuery.mockResolvedValueOnce(makeEvents(20));
    mockParseVideoEvents.mockReturnValueOnce(Array.from({ length: 15 }, (_, index) => makeVideo(index)));

    const { result } = renderHook(
      () => useInfiniteVideos({ feedType: 'trending', sortMode: 'hot', pageSize: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages[0].videos).toHaveLength(15);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('parses page 2 from a disjoint raw event window', async () => {
    const firstPageEvents = makeEvents(20);
    const secondPrefixEvents = makeEvents(40);

    mockNostrQuery
      .mockResolvedValueOnce(firstPageEvents)
      .mockResolvedValueOnce(secondPrefixEvents);
    mockParseVideoEvents
      .mockReturnValueOnce(Array.from({ length: 20 }, (_, index) => makeVideo(index)))
      .mockReturnValueOnce(Array.from({ length: 20 }, (_, index) => makeVideo(20 + index)));

    const { result } = renderHook(
      () => useInfiniteVideos({ feedType: 'trending', sortMode: 'hot', pageSize: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });

    let nextPageResult: Awaited<ReturnType<typeof result.current.fetchNextPage>> | undefined;
    await act(async () => {
      nextPageResult = await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(mockNostrQuery).toHaveBeenCalledTimes(2);
    });

    expect(mockNostrQuery.mock.calls[1]?.[0]).toEqual([
      expect.objectContaining({ limit: 40 }),
    ]);
    expect(mockParseVideoEvents.mock.calls[1]?.[0].map((event: NostrEvent) => event.id)).toEqual(
      secondPrefixEvents.slice(20).map(event => event.id)
    );
    expect(nextPageResult?.data?.pages[1].videos.map(video => video.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => `event-${20 + index}`)
    );
  });

  it('backfills a zero-video sorted window before returning a page', async () => {
    mockNostrQuery
      .mockResolvedValueOnce(makeEvents(20))
      .mockResolvedValueOnce(makeEvents(40));
    mockParseVideoEvents
      .mockReturnValueOnce([])
      .mockReturnValueOnce([makeVideo(25)]);

    const { result } = renderHook(
      () => useInfiniteVideos({ feedType: 'trending', sortMode: 'hot', pageSize: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNostrQuery).toHaveBeenCalledTimes(2);
    expect(mockNostrQuery.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ limit: 20 }),
    ]);
    expect(mockNostrQuery.mock.calls[1]?.[0]).toEqual([
      expect.objectContaining({ limit: 40 }),
    ]);
    expect(result.current.data?.pages[0].videos).toEqual([makeVideo(25)]);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('stops when the relay returns fewer raw events than requested', async () => {
    mockNostrQuery.mockResolvedValueOnce(makeEvents(18));
    mockParseVideoEvents.mockReturnValueOnce(Array.from({ length: 18 }, (_, index) => makeVideo(index)));

    const { result } = renderHook(
      () => useInfiniteVideos({ feedType: 'trending', sortMode: 'hot', pageSize: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages[0].videos).toHaveLength(18);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('stops after exhausting zero-video sorted backfill attempts', async () => {
    mockNostrQuery
      .mockResolvedValueOnce(makeEvents(20))
      .mockResolvedValueOnce(makeEvents(40))
      .mockResolvedValueOnce(makeEvents(60));
    mockParseVideoEvents
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);

    const { result } = renderHook(
      () => useInfiniteVideos({ feedType: 'trending', sortMode: 'hot', pageSize: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNostrQuery).toHaveBeenCalledTimes(3);
    expect(mockNostrQuery.mock.calls.map(call => call[0][0].limit)).toEqual([20, 40, 60]);
    expect(result.current.data?.pages[0].videos).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('stops when an expanded sorted window hits the relay cap before parsing videos', async () => {
    mockNostrQuery
      .mockResolvedValueOnce(makeEvents(20))
      .mockResolvedValueOnce(makeEvents(39));
    mockParseVideoEvents
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);

    const { result } = renderHook(
      () => useInfiniteVideos({ feedType: 'trending', sortMode: 'hot', pageSize: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNostrQuery).toHaveBeenCalledTimes(2);
    expect(result.current.data?.pages[0].videos).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('sorts only the current raw window for client-side Classic ordering', async () => {
    mockNostrQuery
      .mockResolvedValueOnce(makeEvents(2))
      .mockResolvedValueOnce(makeEvents(4));
    mockParseVideoEvents
      .mockReturnValueOnce([
        makeVideo(0, { loopCount: 20 }),
        makeVideo(1, { loopCount: 10 }),
      ])
      .mockReturnValueOnce([
        makeVideo(2, { loopCount: 5 }),
        makeVideo(3, { loopCount: 50 }),
      ]);

    const { result } = renderHook(
      () => useInfiniteVideos({ feedType: 'trending', sortMode: 'top', pageSize: 2 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });

    let nextPageResult: Awaited<ReturnType<typeof result.current.fetchNextPage>> | undefined;
    await act(async () => {
      nextPageResult = await result.current.fetchNextPage();
    });

    expect(mockParseVideoEvents.mock.calls[1]?.[0].map((event: NostrEvent) => event.id)).toEqual(
      ['event-02', 'event-03']
    );
    expect(nextPageResult?.data?.pages[1].videos.map(video => video.id)).toEqual([
      'event-03',
      'event-02',
    ]);
  });
});

describe('useInfiniteVideos chronological relay pagination', () => {
  it('backfills an empty parsed page with the raw event timestamp cursor', async () => {
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
      () => useInfiniteVideos({ feedType: 'recent', pageSize: 2 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNostrQuery).toHaveBeenCalledTimes(2);
    expect(mockNostrQuery.mock.calls[1]?.[0]).toEqual([
      expect.objectContaining({ until: 98 }),
    ]);
    expect(result.current.data?.pages[0].videos).toEqual([makeVideo(3)]);
  });

  it('stops after exhausting zero-video chronological backfill attempts', async () => {
    mockNostrQuery
      .mockResolvedValueOnce([
        makeEvent(1, 100),
        makeEvent(2, 99),
      ])
      .mockResolvedValueOnce([
        makeEvent(3, 80),
        makeEvent(4, 79),
      ])
      .mockResolvedValueOnce([
        makeEvent(5, 60),
        makeEvent(6, 59),
      ]);
    mockParseVideoEvents
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);

    const { result } = renderHook(
      () => useInfiniteVideos({ feedType: 'recent', pageSize: 2 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNostrQuery).toHaveBeenCalledTimes(3);
    expect(mockNostrQuery.mock.calls.map(call => call[0][0].until)).toEqual([
      undefined,
      98,
      78,
    ]);
    expect(result.current.data?.pages[0].videos).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
  });
});
