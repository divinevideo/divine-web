// ABOUTME: Tests for optimistic repost cache updates, kind 5 delete, and repostVideo
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import type { VideoSocialMetrics } from '@/hooks/useVideoSocialMetrics';
import type { UserInteractions } from '@/types/video';

const publishAsync = vi.hoisted(() => vi.fn());
const repostVideoAsync = vi.hoisted(() => vi.fn());
const toastFn = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: publishAsync,
  }),
}));

vi.mock('@/hooks/usePublishVideo', () => ({
  usePublishVideo: vi.fn(),
  useRepostVideo: () => ({
    mutateAsync: repostVideoAsync,
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: toastFn,
  }),
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

const VIDEO_ID = '02' + 'cd'.repeat(31);
const AUTHOR_PK = 'e3' + 'cd'.repeat(31);
const VIEWER_PK = 'f4' + 'cd'.repeat(31);
const VINE_ID = 'vine-repost';

function metricsKey() {
  return ['video-social-metrics', VIDEO_ID, AUTHOR_PK, VINE_ID] as const;
}

function interactionsKey() {
  return ['video-user-interactions', VIDEO_ID, VIEWER_PK] as const;
}

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { queryClient, Wrapper };
}

describe('useOptimisticRepost', () => {
  let useOptimisticRepost: typeof import('./useOptimisticRepost').useOptimisticRepost;

  beforeEach(async () => {
    vi.clearAllMocks();
    publishAsync.mockResolvedValue(undefined);
    repostVideoAsync.mockResolvedValue({ id: 'new-repost-event-id' });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const mod = await import('./useOptimisticRepost');
    useOptimisticRepost = mod.useOptimisticRepost;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('un-reposts optimistically and publishes kind 5 when repost event id exists', async () => {
    const { queryClient, Wrapper } = createHarness();
    const mKey = metricsKey();
    const iKey = interactionsKey();

    queryClient.setQueryData(mKey, {
      likeCount: 0,
      repostCount: 4,
      viewCount: 1,
      commentCount: 0,
      likes: [],
      reposts: [],
    });
    queryClient.setQueryData(iKey, {
      hasLiked: false,
      hasReposted: true,
      likeEventId: null,
      repostEventId: 'repost-ev-1',
    });

    const { result } = renderHook(() => useOptimisticRepost(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.toggleRepost({
        videoId: VIDEO_ID,
        videoPubkey: AUTHOR_PK,
        vineId: VINE_ID,
        userPubkey: VIEWER_PK,
        isCurrentlyReposted: true,
        currentRepostEventId: 'repost-ev-1',
      });
    });

    expect(queryClient.getQueryData(mKey)).toMatchObject({ repostCount: 3 });
    expect(queryClient.getQueryData(iKey)).toMatchObject({
      hasReposted: false,
      repostEventId: null,
    });

    expect(publishAsync).toHaveBeenCalledWith({
      kind: 5,
      content: 'Un-reposted',
      tags: [['e', 'repost-ev-1']],
    });
    expect(repostVideoAsync).not.toHaveBeenCalled();
  });

  it('does not publish when removing repost without stored repost event id', async () => {
    const { queryClient, Wrapper } = createHarness();

    queryClient.setQueryData(metricsKey(), {
      likeCount: 0,
      repostCount: 1,
      viewCount: 0,
      commentCount: 0,
      likes: [],
      reposts: [],
    });
    queryClient.setQueryData(interactionsKey(), {
      hasLiked: false,
      hasReposted: true,
      likeEventId: null,
      repostEventId: null,
    });

    const { result } = renderHook(() => useOptimisticRepost(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.toggleRepost({
        videoId: VIDEO_ID,
        videoPubkey: AUTHOR_PK,
        vineId: VINE_ID,
        userPubkey: VIEWER_PK,
        isCurrentlyReposted: true,
        currentRepostEventId: null,
      });
    });

    expect(publishAsync).not.toHaveBeenCalled();
  });

  it('floors repostCount at 0 when removing repost with zero reposts in cache', async () => {
    const { queryClient, Wrapper } = createHarness();

    queryClient.setQueryData(metricsKey(), {
      likeCount: 0,
      repostCount: 0,
      viewCount: 0,
      commentCount: 0,
      likes: [],
      reposts: [],
    });
    queryClient.setQueryData(interactionsKey(), {
      hasLiked: false,
      hasReposted: true,
      likeEventId: null,
      repostEventId: 'rp-edge',
    });

    const { result } = renderHook(() => useOptimisticRepost(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.toggleRepost({
        videoId: VIDEO_ID,
        videoPubkey: AUTHOR_PK,
        vineId: VINE_ID,
        userPubkey: VIEWER_PK,
        isCurrentlyReposted: true,
        currentRepostEventId: 'rp-edge',
      });
    });

    expect(queryClient.getQueryData(metricsKey())).toMatchObject({ repostCount: 0 });
    expect(publishAsync).toHaveBeenCalled();
  });

  it('reposts optimistically, calls repostVideo, then stores returned event id', async () => {
    const { queryClient, Wrapper } = createHarness();
    const mKey = metricsKey();
    const iKey = interactionsKey();

    repostVideoAsync.mockResolvedValueOnce({ id: 'published-repost-id' });

    queryClient.setQueryData(mKey, {
      likeCount: 10,
      repostCount: 0,
      viewCount: 100,
      commentCount: 2,
      likes: [],
      reposts: [],
    });
    queryClient.setQueryData(iKey, {
      hasLiked: true,
      hasReposted: false,
      likeEventId: 'lk1',
      repostEventId: null,
    });

    const { result } = renderHook(() => useOptimisticRepost(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.toggleRepost({
        videoId: VIDEO_ID,
        videoPubkey: AUTHOR_PK,
        vineId: VINE_ID,
        userPubkey: VIEWER_PK,
        isCurrentlyReposted: false,
        currentRepostEventId: null,
      });
    });

    expect(repostVideoAsync).toHaveBeenCalledWith({
      originalPubkey: AUTHOR_PK,
      vineId: VINE_ID,
    });
    expect(publishAsync).not.toHaveBeenCalled();

    expect(queryClient.getQueryData(mKey)).toMatchObject({ repostCount: 1 });
    expect(queryClient.getQueryData(iKey)).toMatchObject({
      hasReposted: true,
      repostEventId: 'published-repost-id',
    });
  });

  it('rolls back cache when repostVideo fails', async () => {
    const { queryClient, Wrapper } = createHarness();
    const mKey = metricsKey();
    const iKey = interactionsKey();

    const metricsBefore: VideoSocialMetrics = {
      likeCount: 1,
      repostCount: 2,
      viewCount: 3,
      commentCount: 0,
      likes: [],
      reposts: [],
    };
    const interactionsBefore: UserInteractions = {
      hasLiked: false,
      hasReposted: false,
      likeEventId: null,
      repostEventId: null,
    };

    queryClient.setQueryData(mKey, metricsBefore);
    queryClient.setQueryData(iKey, interactionsBefore);

    repostVideoAsync.mockRejectedValueOnce(new Error('publish failed'));

    const { result } = renderHook(() => useOptimisticRepost(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.toggleRepost({
        videoId: VIDEO_ID,
        videoPubkey: AUTHOR_PK,
        vineId: VINE_ID,
        userPubkey: VIEWER_PK,
        isCurrentlyReposted: false,
        currentRepostEventId: null,
      });
    });

    expect(queryClient.getQueryData(mKey)).toEqual(metricsBefore);
    expect(queryClient.getQueryData(iKey)).toEqual(interactionsBefore);
    expect(toastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'Failed to repost video',
      })
    );
  });

  it('rolls back cache when kind 5 delete publish fails', async () => {
    const { queryClient, Wrapper } = createHarness();
    const mKey = metricsKey();
    const iKey = interactionsKey();

    const metricsBefore: VideoSocialMetrics = {
      likeCount: 0,
      repostCount: 2,
      viewCount: 0,
      commentCount: 0,
      likes: [],
      reposts: [],
    };
    const interactionsBefore: UserInteractions = {
      hasLiked: false,
      hasReposted: true,
      likeEventId: null,
      repostEventId: 'rp-del',
    };

    queryClient.setQueryData(mKey, metricsBefore);
    queryClient.setQueryData(iKey, interactionsBefore);

    publishAsync.mockRejectedValueOnce(new Error('delete failed'));

    const { result } = renderHook(() => useOptimisticRepost(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.toggleRepost({
        videoId: VIDEO_ID,
        videoPubkey: AUTHOR_PK,
        vineId: VINE_ID,
        userPubkey: VIEWER_PK,
        isCurrentlyReposted: true,
        currentRepostEventId: 'rp-del',
      });
    });

    expect(queryClient.getQueryData(mKey)).toEqual(metricsBefore);
    expect(queryClient.getQueryData(iKey)).toEqual(interactionsBefore);
    expect(toastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'Failed to remove repost',
      })
    );
  });
});
