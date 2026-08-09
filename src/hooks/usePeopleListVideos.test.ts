// ABOUTME: Tests paginated relay video queries for people-list members

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

const mockNostrQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: { query: mockNostrQuery } }),
}));

let mockBlocklist = new Set<string>();
vi.mock('@/hooks/useFeedBlocklist', () => ({
  useFeedBlocklist: () => mockBlocklist,
}));

const ALICE = 'b'.repeat(64);
const BOB = 'c'.repeat(64);

let fixtureCounter = 0;
function videoEvent(pubkey: string, dTag: string, createdAt: number): NostrEvent {
  fixtureCounter += 1;
  return {
    id: fixtureCounter.toString(16).padStart(64, '0'),
    pubkey,
    kind: 34236,
    created_at: createdAt,
    tags: [
      ['d', dTag],
      ['imeta', `url https://cdn.example.com/${dTag}.mp4`, 'm video/mp4'],
    ],
    content: '',
    sig: 'f'.repeat(128),
  };
}

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe('usePeopleListVideos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlocklist = new Set();
    mockNostrQuery.mockResolvedValue([]);
  });

  it('queries member authors in bounded batches', async () => {
    const members = Array.from({ length: 101 }, (_, index) => index.toString(16).padStart(64, '0'));
    const { usePeopleListVideos } = await import('./usePeopleListVideos');

    const { result } = renderHook(() => usePeopleListVideos(members), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const filters = mockNostrQuery.mock.calls[0][0];
    expect(filters).toHaveLength(2);
    expect(filters[0].authors).toHaveLength(100);
    expect(filters[1].authors).toHaveLength(1);
    expect(filters.every((filter: { limit: number }) => filter.limit === 60)).toBe(true);
  });

  it('stays idle for an empty people list', async () => {
    const { usePeopleListVideos } = await import('./usePeopleListVideos');
    const { result } = renderHook(() => usePeopleListVideos([]), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });

  it('hides videos from blocked or muted authors', async () => {
    mockBlocklist = new Set([BOB]);
    mockNostrQuery.mockResolvedValue([
      videoEvent(ALICE, 'alice-loop', 200),
      videoEvent(BOB, 'bob-loop', 100),
    ]);
    const { usePeopleListVideos } = await import('./usePeopleListVideos');

    const { result } = renderHook(() => usePeopleListVideos([ALICE, BOB]), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const videos = result.current.data?.pages.flatMap((page) => page.videos) ?? [];
    expect(videos).toHaveLength(1);
    expect(videos[0].pubkey).toBe(ALICE);
  });

  it('keeps paginating when a full raw page dedupes below the page cap', async () => {
    // 60 raw events that collapse to 2 addressable videos: dedupe must not
    // be mistaken for the relay having no older events left.
    const rawPage = [
      ...Array.from({ length: 59 }, (_, index) => videoEvent(ALICE, 'dupe', 1000 + index)),
      videoEvent(ALICE, 'unique', 1059),
    ];
    mockNostrQuery.mockResolvedValueOnce(rawPage).mockResolvedValue([]);
    const { usePeopleListVideos } = await import('./usePeopleListVideos');

    const { result } = renderHook(() => usePeopleListVideos([ALICE]), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages[0].videos).toHaveLength(2);
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();
    await waitFor(() => expect(mockNostrQuery).toHaveBeenCalledTimes(2));

    // Cursor derives from the oldest raw event, not the deduped page size, and stays inclusive.
    const secondFilters = mockNostrQuery.mock.calls[1][0];
    expect(secondFilters[0].until).toBe(1000);
  });

  it('continues from the oldest retained video when raw results exceed the page cap', async () => {
    const rawPage = Array.from({ length: 120 }, (_, index) => (
      videoEvent(ALICE, `video-${index}`, 1000 - index)
    ));
    mockNostrQuery.mockResolvedValueOnce(rawPage).mockResolvedValue([]);
    const { usePeopleListVideos } = await import('./usePeopleListVideos');

    const { result } = renderHook(() => usePeopleListVideos([ALICE]), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages[0].videos).toHaveLength(60);
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();
    await waitFor(() => expect(mockNostrQuery).toHaveBeenCalledTimes(2));

    const secondFilters = mockNostrQuery.mock.calls[1][0];
    expect(secondFilters[0].until).toBe(941);
  });

  it('keeps same-timestamp boundary videos reachable across pages', async () => {
    const firstPage = [
      ...Array.from({ length: 59 }, (_, index) => (
        videoEvent(ALICE, `first-${index}`, 1000 - index)
      )),
      videoEvent(ALICE, 'boundary-a', 941),
    ];
    const secondPage = [
      videoEvent(ALICE, 'boundary-a', 941),
      videoEvent(ALICE, 'boundary-b', 941),
    ];
    mockNostrQuery.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage);
    const { usePeopleListVideos } = await import('./usePeopleListVideos');

    const { result } = renderHook(() => usePeopleListVideos([ALICE]), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await result.current.fetchNextPage();
    await waitFor(() => expect(mockNostrQuery).toHaveBeenCalledTimes(2));

    const secondFilters = mockNostrQuery.mock.calls[1][0];
    expect(secondFilters[0].until).toBe(941);
    const videos = result.current.data?.pages.flatMap((page) => page.videos) ?? [];
    expect(videos.map((video) => video.vineId)).toContain('boundary-a');
    expect(videos.map((video) => video.vineId)).toContain('boundary-b');
  });

  it('stops paginating when an inclusive boundary page adds no new videos', async () => {
    const firstPage = Array.from({ length: 60 }, (_, index) => (
      videoEvent(ALICE, `video-${index}`, 1000 - index)
    ));
    const duplicateBoundary = [videoEvent(ALICE, 'video-59', 941)];
    mockNostrQuery.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(duplicateBoundary);
    const { usePeopleListVideos } = await import('./usePeopleListVideos');

    const { result } = renderHook(() => usePeopleListVideos([ALICE]), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();
    await waitFor(() => expect(mockNostrQuery).toHaveBeenCalledTimes(2));

    expect(result.current.hasNextPage).toBe(false);
    const videos = result.current.data?.pages.flatMap((page) => page.videos) ?? [];
    expect(videos).toHaveLength(60);
  });

  it('stops paginating when the raw page comes back below the limit', async () => {
    mockNostrQuery.mockResolvedValue([
      videoEvent(ALICE, 'one', 200),
      videoEvent(ALICE, 'two', 100),
    ]);
    const { usePeopleListVideos } = await import('./usePeopleListVideos');

    const { result } = renderHook(() => usePeopleListVideos([ALICE]), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.hasNextPage).toBe(false);
  });
});
