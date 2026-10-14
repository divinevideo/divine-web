// ABOUTME: Tests that useVideoProvider reports a fetched-row count from unfiltered pages
// ABOUTME: divine-web#380 — infinite scroll stalls when the rendered length stops growing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVideoProvider } from './useVideoProvider';

const BLOCKED_AUTHOR = 'b'.repeat(64);
const OK_AUTHOR = 'a'.repeat(64);

let mockBlocklist: ReadonlySet<string> = new Set();

function makeVideo(pubkey: string, id: string) {
  return {
    id,
    pubkey,
    kind: 34236,
    createdAt: 1700000000,
    content: '',
    videoUrl: `https://cdn.example/${id}.mp4`,
    hashtags: [],
    vineId: id,
    reposts: [],
  };
}

let funnelcakeData: { pages: Array<{ videos: ReturnType<typeof makeVideo>[]; nextCursor: undefined }>; pageParams: unknown[] };

vi.mock('@/hooks/useFeedBlocklist', () => ({
  useFeedBlocklist: () => mockBlocklist,
}));

vi.mock('@/hooks/useInfiniteVideosFunnelcake', () => ({
  useInfiniteVideosFunnelcake: () => ({
    data: funnelcakeData,
    fetchNextPage: vi.fn(),
    hasNextPage: true,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useInfiniteVideos', () => ({
  useInfiniteVideos: () => ({
    data: undefined,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFeaturedTabVideos', () => ({
  useFeaturedTabVideos: () => ({
    data: undefined,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({ config: { relayUrl: 'wss://relay.divine.video' } }),
}));

vi.mock('@/hooks/useRelayCapabilities', () => ({
  useResolvedRelayCapabilities: () => ({ supportsVideoSorts: true }),
}));

describe('useVideoProvider fetchedCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlocklist = new Set();
    funnelcakeData = {
      pages: [{ videos: [makeVideo(OK_AUTHOR, 'ok-1'), makeVideo(OK_AUTHOR, 'ok-2')], nextCursor: undefined }],
      pageParams: [undefined],
    };
  });

  it('counts every fetched row', () => {
    const { result } = renderHook(() =>
      useVideoProvider({ feedType: 'profile', pubkey: OK_AUTHOR })
    );
    expect(result.current.fetchedCount).toBe(2);
  });

  it('is 0 before the first page arrives', () => {
    funnelcakeData = { pages: [], pageParams: [] };
    const { result } = renderHook(() =>
      useVideoProvider({ feedType: 'profile', pubkey: OK_AUTHOR })
    );
    expect(result.current.fetchedCount).toBe(0);
  });

  // The stall in divine-web#380: a fetched page whose authors are all blocked
  // disappears from `data` entirely. If the scroll trigger keyed off the
  // rendered length it would never re-arm and the grid would stop paginating.
  it('grows when a fetched page is entirely blocked authors', () => {
    mockBlocklist = new Set([BLOCKED_AUTHOR]);
    const { result, rerender } = renderHook(() =>
      useVideoProvider({ feedType: 'profile', pubkey: OK_AUTHOR })
    );
    const before = result.current.fetchedCount;
    const renderedBefore = result.current.data?.pages.flatMap(p => p.videos).length ?? 0;

    funnelcakeData = {
      pages: [
        ...funnelcakeData.pages,
        { videos: [makeVideo(BLOCKED_AUTHOR, 'blocked-1'), makeVideo(BLOCKED_AUTHOR, 'blocked-2')], nextCursor: undefined },
      ],
      pageParams: [undefined, undefined],
    };
    rerender();

    const renderedAfter = result.current.data?.pages.flatMap(p => p.videos).length ?? 0;
    expect(renderedAfter).toBe(renderedBefore); // nothing new is displayed
    expect(result.current.fetchedCount).toBeGreaterThan(before); // but the fetch counts
    expect(result.current.fetchedCount).toBe(4);
  });
});
