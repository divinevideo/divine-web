import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { buildVideoNavigationUrl, parseVideoNavigationContext, useVideoNavigation } from './useVideoNavigation';

const { mockUseVideoEvents, mockBlocklist } = vi.hoisted(() => ({
  mockUseVideoEvents: vi.fn(),
  mockBlocklist: new Set<string>(),
}));

vi.mock('./useVideoEvents', () => ({
  useVideoEvents: mockUseVideoEvents,
}));

vi.mock('@/hooks/usePeopleLists', () => ({
  usePeopleList: () => ({ data: null, isLoading: false }),
}));

vi.mock('@/hooks/usePeopleListVideos', () => ({
  usePeopleListVideos: () => ({ data: null, isLoading: false }),
}));

vi.mock('@/hooks/useFeedBlocklist', () => ({
  useFeedBlocklist: () => mockBlocklist,
}));

function createWrapper(path: string) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(MemoryRouter, { initialEntries: [path] }, children);
  };
}

describe('useVideoNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlocklist.clear();
    mockUseVideoEvents.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  it('round-trips featured tab context through video navigation urls', () => {
    const url = buildVideoNavigationUrl('video-1', {
      source: 'featured',
      featuredTabId: 'ft_1234abcd',
      currentIndex: 4,
    }, 4);

    const parsed = parseVideoNavigationContext(new URL(url, 'https://divine.video').searchParams);

    expect(parsed).toEqual({
      source: 'featured',
      hashtag: undefined,
      pubkey: undefined,
      listId: undefined,
      featuredTabId: 'ft_1234abcd',
      query: undefined,
      sortMode: undefined,
      currentIndex: 4,
    });
  });

  it('uses an explicit trending context when featured neighbors are unavailable', () => {
    renderHook(
      () => useVideoNavigation('video-1', { context: { source: 'trending' } }),
      { wrapper: createWrapper('/video/video-1?source=featured&featuredTabId=ft_1234abcd&index=0') }
    );

    expect(mockUseVideoEvents).toHaveBeenCalledWith({
      feedType: 'trending',
      hashtag: undefined,
      pubkey: undefined,
      limit: 50,
      enabled: true,
    });
  });

  it('filters blocked authors out of WebSocket navigation candidates before index math', () => {
    const blockedPubkey = 'b'.repeat(64);
    mockBlocklist.add(blockedPubkey);
    mockUseVideoEvents.mockReturnValue({
      data: [
        { id: 'video-1', pubkey: 'a'.repeat(64) },
        { id: 'blocked-video', pubkey: blockedPubkey },
        { id: 'video-2', pubkey: 'c'.repeat(64) },
      ],
      isLoading: false,
    });

    const { result } = renderHook(
      () => useVideoNavigation('video-1'),
      { wrapper: createWrapper('/video/video-1?source=trending&index=0') }
    );

    expect(result.current.videos?.map((video) => video.id)).toEqual(['video-1', 'video-2']);
    expect(result.current.hasNext).toBe(true);
  });
});
