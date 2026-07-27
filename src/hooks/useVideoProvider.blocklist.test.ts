// ABOUTME: Tests that useVideoProvider drops videos from blocked/muted authors at the hook boundary
// ABOUTME: so every feed surface (hashtag/discovery/profile/home) inherits per-viewer filtering

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

const funnelcakeData = {
  pages: [
    { videos: [makeVideo(OK_AUTHOR, 'ok-1'), makeVideo(BLOCKED_AUTHOR, 'blocked-1')], nextCursor: undefined },
    { videos: [makeVideo(BLOCKED_AUTHOR, 'blocked-2'), makeVideo(OK_AUTHOR, 'ok-2')], nextCursor: undefined },
  ],
  pageParams: [undefined],
};

vi.mock('@/hooks/useFeedBlocklist', () => ({
  useFeedBlocklist: () => mockBlocklist,
}));

vi.mock('@/hooks/useInfiniteVideosFunnelcake', () => ({
  useInfiniteVideosFunnelcake: () => ({
    data: funnelcakeData,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
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

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({ config: { relayUrl: 'wss://relay.divine.video' } }),
}));

vi.mock('@/hooks/useRelayCapabilities', () => ({
  useResolvedRelayCapabilities: () => ({ supportsVideoSorts: true }),
}));

describe('useVideoProvider blocklist filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlocklist = new Set();
  });

  it("drops a blocked author's videos from every page (hashtag feed)", () => {
    mockBlocklist = new Set([BLOCKED_AUTHOR]);
    const { result } = renderHook(() =>
      useVideoProvider({ feedType: 'hashtag', hashtag: 'comedy' })
    );
    const videos = result.current.data?.pages.flatMap(p => p.videos) ?? [];
    expect(videos.map(v => v.id)).toEqual(['ok-1', 'ok-2']);
  });

  it("drops a blocked author's videos from the discovery feed", () => {
    mockBlocklist = new Set([BLOCKED_AUTHOR]);
    const { result } = renderHook(() => useVideoProvider({ feedType: 'discovery' }));
    const videos = result.current.data?.pages.flatMap(p => p.videos) ?? [];
    expect(videos.every(v => v.pubkey !== BLOCKED_AUTHOR)).toBe(true);
    expect(videos).toHaveLength(2);
  });

  it("drops a blocked author's videos from the profile feed", () => {
    mockBlocklist = new Set([BLOCKED_AUTHOR]);
    const { result } = renderHook(() =>
      useVideoProvider({ feedType: 'profile', pubkey: BLOCKED_AUTHOR })
    );
    const videos = result.current.data?.pages.flatMap(p => p.videos) ?? [];
    expect(videos.map(v => v.id)).toEqual(['ok-1', 'ok-2']);
  });

  it('passes data through untouched when the blocklist is empty', () => {
    const { result } = renderHook(() => useVideoProvider({ feedType: 'discovery' }));
    expect(result.current.data).toBe(funnelcakeData);
  });
});
