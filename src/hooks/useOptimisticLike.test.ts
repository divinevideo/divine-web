// ABOUTME: Tests for optimistic like cache updates and Nostr publish calls
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { SHORT_VIDEO_KIND } from '@/types/video';
import type { VideoSocialMetrics } from '@/hooks/useVideoSocialMetrics';
import type { UserInteractions } from '@/types/video';

const publishAsync = vi.hoisted(() => vi.fn());
const toastFn = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: publishAsync,
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

const VIDEO_ID = '01' + 'ab'.repeat(31);
const AUTHOR_PK = 'c1' + 'ab'.repeat(31);
const VIEWER_PK = 'd2' + 'ab'.repeat(31);
const VINE_ID = 'vine-xyz';

function metricsKey(vineId: string | null) {
  return ['video-social-metrics', VIDEO_ID, AUTHOR_PK, vineId] as const;
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

describe('useOptimisticLike', () => {
  let useOptimisticLike: typeof import('./useOptimisticLike').useOptimisticLike;

  beforeEach(async () => {
    vi.clearAllMocks();
    publishAsync.mockResolvedValue({ id: 'signed-like-id' });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const mod = await import('./useOptimisticLike');
    useOptimisticLike = mod.useOptimisticLike;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('unlikes optimistically and publishes kind 5 delete when like event id exists', async () => {
    const { queryClient, Wrapper } = createHarness();
    const mKey = metricsKey(VINE_ID);
    const iKey = interactionsKey();

    const previousMetrics: VideoSocialMetrics = {
      likeCount: 3,
      repostCount: 0,
      viewCount: 10,
      commentCount: 1,
      likes: [],
      reposts: [],
    };
    const previousInteractions: UserInteractions = {
      hasLiked: true,
      hasReposted: false,
      likeEventId: 'like-event-hex',
      repostEventId: null,
    };

    queryClient.setQueryData(mKey, previousMetrics);
    queryClient.setQueryData(iKey, previousInteractions);

    const { result } = renderHook(() => useOptimisticLike(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.toggleLike({
        videoId: VIDEO_ID,
        videoPubkey: AUTHOR_PK,
        vineId: VINE_ID,
        userPubkey: VIEWER_PK,
        isCurrentlyLiked: true,
        currentLikeEventId: 'like-event-hex',
      });
    });

    expect(queryClient.getQueryData(mKey)).toMatchObject({ likeCount: 2 });
    expect(queryClient.getQueryData(iKey)).toMatchObject({
      hasLiked: false,
      likeEventId: null,
    });

    expect(publishAsync).toHaveBeenCalledWith({
      kind: 5,
      content: 'Unliked',
      tags: [['e', 'like-event-hex']],
    });
    expect(toastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Unliked.',
      })
    );
  });

  it('does not publish when unliking without a stored like event id', async () => {
    const { queryClient, Wrapper } = createHarness();
    const mKey = metricsKey(VINE_ID);
    const iKey = interactionsKey();

    queryClient.setQueryData(mKey, {
      likeCount: 1,
      repostCount: 0,
      viewCount: 0,
      commentCount: 0,
      likes: [],
      reposts: [],
    });
    queryClient.setQueryData(iKey, {
      hasLiked: true,
      hasReposted: false,
      likeEventId: null,
      repostEventId: null,
    });

    const { result } = renderHook(() => useOptimisticLike(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.toggleLike({
        videoId: VIDEO_ID,
        videoPubkey: AUTHOR_PK,
        vineId: VINE_ID,
        userPubkey: VIEWER_PK,
        isCurrentlyLiked: true,
        currentLikeEventId: null,
      });
    });

    expect(publishAsync).not.toHaveBeenCalled();
  });

  it('floors likeCount at 0 when unliking with zero likes in cache', async () => {
    const { queryClient, Wrapper } = createHarness();
    const mKey = metricsKey(VINE_ID);
    const iKey = interactionsKey();

    queryClient.setQueryData(mKey, {
      likeCount: 0,
      repostCount: 0,
      viewCount: 1,
      commentCount: 0,
      likes: [],
      reposts: [],
    });
    queryClient.setQueryData(iKey, {
      hasLiked: true,
      hasReposted: false,
      likeEventId: 'orphan-like',
      repostEventId: null,
    });

    const { result } = renderHook(() => useOptimisticLike(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.toggleLike({
        videoId: VIDEO_ID,
        videoPubkey: AUTHOR_PK,
        vineId: VINE_ID,
        userPubkey: VIEWER_PK,
        isCurrentlyLiked: true,
        currentLikeEventId: 'orphan-like',
      });
    });

    expect(queryClient.getQueryData(mKey)).toMatchObject({ likeCount: 0 });
    expect(publishAsync).toHaveBeenCalled();
  });

  it('likes optimistically, publishes kind 7, then stores returned event id', async () => {
    const { queryClient, Wrapper } = createHarness();
    const mKey = metricsKey(null);
    const iKey = interactionsKey();

    publishAsync.mockResolvedValueOnce({ id: 'relay-like-id' });

    queryClient.setQueryData(mKey, {
      likeCount: 0,
      repostCount: 0,
      viewCount: 5,
      commentCount: 0,
      likes: [],
      reposts: [],
    });
    queryClient.setQueryData(iKey, {
      hasLiked: false,
      hasReposted: false,
      likeEventId: null,
      repostEventId: null,
    });

    const { result } = renderHook(() => useOptimisticLike(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.toggleLike({
        videoId: VIDEO_ID,
        videoPubkey: AUTHOR_PK,
        vineId: null,
        userPubkey: VIEWER_PK,
        isCurrentlyLiked: false,
        currentLikeEventId: null,
      });
    });

    expect(publishAsync).toHaveBeenCalledWith({
      kind: 7,
      content: '+',
      tags: [
        ['e', VIDEO_ID],
        ['a', `${SHORT_VIDEO_KIND}:${AUTHOR_PK}:null`],
        ['p', AUTHOR_PK],
      ],
    });

    expect(queryClient.getQueryData(iKey)).toMatchObject({
      hasLiked: true,
      likeEventId: 'relay-like-id',
    });
    expect(queryClient.getQueryData(mKey)).toMatchObject({ likeCount: 1 });
  });

  it('rolls back cache when publish fails', async () => {
    const { queryClient, Wrapper } = createHarness();
    const mKey = metricsKey(VINE_ID);
    const iKey = interactionsKey();

    const metricsBefore: VideoSocialMetrics = {
      likeCount: 2,
      repostCount: 1,
      viewCount: 7,
      commentCount: 0,
      likes: [],
      reposts: [],
    };
    const interactionsBefore: UserInteractions = {
      hasLiked: false,
      hasReposted: true,
      likeEventId: null,
      repostEventId: 'rp1',
    };

    queryClient.setQueryData(mKey, metricsBefore);
    queryClient.setQueryData(iKey, interactionsBefore);

    publishAsync.mockRejectedValueOnce(new Error('relay error'));

    const { result } = renderHook(() => useOptimisticLike(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.toggleLike({
        videoId: VIDEO_ID,
        videoPubkey: AUTHOR_PK,
        vineId: VINE_ID,
        userPubkey: VIEWER_PK,
        isCurrentlyLiked: false,
        currentLikeEventId: null,
      });
    });

    expect(queryClient.getQueryData(mKey)).toEqual(metricsBefore);
    expect(queryClient.getQueryData(iKey)).toEqual(interactionsBefore);
    expect(toastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: 'Error',
      })
    );
  });

  it('rolls back cache when unlike publish fails', async () => {
    const { queryClient, Wrapper } = createHarness();
    const mKey = metricsKey(VINE_ID);
    const iKey = interactionsKey();

    const metricsBefore: VideoSocialMetrics = {
      likeCount: 5,
      repostCount: 0,
      viewCount: 1,
      commentCount: 0,
      likes: [],
      reposts: [],
    };
    const interactionsBefore: UserInteractions = {
      hasLiked: true,
      hasReposted: false,
      likeEventId: 'lk-del',
      repostEventId: null,
    };

    queryClient.setQueryData(mKey, metricsBefore);
    queryClient.setQueryData(iKey, interactionsBefore);

    publishAsync.mockRejectedValueOnce(new Error('delete failed'));

    const { result } = renderHook(() => useOptimisticLike(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.toggleLike({
        videoId: VIDEO_ID,
        videoPubkey: AUTHOR_PK,
        vineId: VINE_ID,
        userPubkey: VIEWER_PK,
        isCurrentlyLiked: true,
        currentLikeEventId: 'lk-del',
      });
    });

    expect(queryClient.getQueryData(mKey)).toEqual(metricsBefore);
    expect(queryClient.getQueryData(iKey)).toEqual(interactionsBefore);
    expect(toastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'Failed to unlike video',
      })
    );
  });
});
