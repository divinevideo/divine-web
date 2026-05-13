// ABOUTME: Hook tests for usePostComment — NIP-22 tags and React Query optimistic updates
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { NostrEvent } from '@nostrify/nostrify';

import { buildNip22CommentTags } from '@/lib/buildNip22CommentTags';
import { SHORT_VIDEO_KIND } from '@/types/video';

const publishAsync = vi.hoisted(() => vi.fn());

const USER_PK = 'u1' + 'ee'.repeat(31);

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: publishAsync,
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: USER_PK },
  }),
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

const VIDEO_ID = '03' + 'ff'.repeat(31);
const PK_AUTHOR = 'a3' + 'ff'.repeat(31);

function videoRoot(): NostrEvent {
  return {
    id: VIDEO_ID,
    pubkey: PK_AUTHOR,
    kind: SHORT_VIDEO_KIND,
    tags: [['d', 'vine-q']],
    content: '',
    created_at: 100,
    sig: '22'.repeat(64),
  };
}

function existingComment(id: string): NostrEvent {
  return {
    id,
    pubkey: PK_AUTHOR,
    kind: 1111,
    tags: [['e', VIDEO_ID]],
    content: 'Earlier',
    created_at: 99,
    sig: '33'.repeat(64),
  };
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

describe('usePostComment', () => {
  let usePostComment: typeof import('./usePostComment').usePostComment;

  beforeEach(async () => {
    vi.clearAllMocks();
    publishAsync.mockResolvedValue({
      id: 'published-id',
      kind: 1111,
      pubkey: USER_PK,
      content: 'x',
      tags: [],
      created_at: 200,
      sig: '44'.repeat(64),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const mod = await import('./usePostComment');
    usePostComment = mod.usePostComment;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls publishEvent with kind 1111, content, and buildNip22CommentTags output', async () => {
    const { Wrapper } = createHarness();
    const root = videoRoot();

    const { result } = renderHook(() => usePostComment(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        root,
        content: 'Nice loop.',
      });
    });

    expect(publishAsync).toHaveBeenCalledWith({
      kind: 1111,
      content: 'Nice loop.',
      tags: buildNip22CommentTags(root),
    });
  });

  it('includes reply target in tags when replying to an existing comment', async () => {
    const { Wrapper } = createHarness();
    const root = videoRoot();
    const replyTo = existingComment('parent-comment-id');

    const { result } = renderHook(() => usePostComment(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        root,
        reply: replyTo,
        content: 'Thread reply.',
      });
    });

    expect(publishAsync).toHaveBeenCalledWith({
      kind: 1111,
      content: 'Thread reply.',
      tags: buildNip22CommentTags(root, replyTo),
    });
  });

  it('onMutate cancels queries and prepends optimistic comment before publish resolves', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    let finishPublish!: (event: NostrEvent) => void;
    publishAsync.mockImplementation(
      () =>
        new Promise<NostrEvent>((resolve) => {
          finishPublish = resolve;
        })
    );

    const { queryClient, Wrapper } = createHarness();
    const queryKey = ['nostr', 'comments', VIDEO_ID, 50] as const;
    const prev = existingComment('older');

    queryClient.setQueryData(queryKey, {
      allComments: [prev],
      topLevelComments: [prev],
    });

    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');

    const { result } = renderHook(() => usePostComment(), { wrapper: Wrapper });

    let mutateDone!: Promise<unknown>;
    await act(async () => {
      mutateDone = result.current.mutateAsync({
        root: videoRoot(),
        content: 'New top-level',
      });
    });

    await waitFor(() => {
      const data = queryClient.getQueryData<{
        allComments: Array<NostrEvent & { _optimistic?: boolean }>;
      }>(queryKey);
      expect(data?.allComments[0]?.id).toBe('temp-1700000000000');
    });

    expect(cancelSpy).toHaveBeenCalledWith({
      queryKey: ['nostr', 'comments', VIDEO_ID],
    });

    const mid = queryClient.getQueryData<{
      allComments: Array<NostrEvent & { _optimistic?: boolean }>;
      topLevelComments: Array<NostrEvent & { _optimistic?: boolean }>;
    }>(queryKey);

    expect(mid?.allComments[0]?.content).toBe('New top-level');
    expect(mid?.allComments[0]?._optimistic).toBe(true);
    expect(mid?.topLevelComments[0]?.id).toBe('temp-1700000000000');

    await act(async () => {
      finishPublish({
        id: 'published-id',
        kind: 1111,
        pubkey: USER_PK,
        content: 'New top-level',
        tags: buildNip22CommentTags(videoRoot()),
        created_at: 200,
        sig: '44'.repeat(64),
      });
      await mutateDone;
    });
  });

  it('onSuccess replaces optimistic comment and schedules invalidateQueries after 6s', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.useFakeTimers();

    const { queryClient, Wrapper } = createHarness();
    const queryKey = ['nostr', 'comments', VIDEO_ID, 50] as const;
    const prev = existingComment('older');

    queryClient.setQueryData(queryKey, {
      allComments: [prev],
      topLevelComments: [prev],
    });

    const signed: NostrEvent = {
      id: 'final-comment-id',
      pubkey: USER_PK,
      kind: 1111,
      tags: buildNip22CommentTags(videoRoot()),
      content: 'New top-level',
      created_at: 300,
      sig: '55'.repeat(64),
    };

    publishAsync.mockResolvedValueOnce(signed);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => usePostComment(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        root: videoRoot(),
        content: 'New top-level',
      });
    });

    const data = queryClient.getQueryData<{
      allComments: NostrEvent[];
      topLevelComments: NostrEvent[];
    }>(queryKey);

    expect(data?.allComments[0]?.id).toBe('final-comment-id');
    expect(data?.allComments.some((c) => c.id === 'temp-1700000000000')).toBe(false);

    expect(invalidateSpy).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['nostr', 'comments', VIDEO_ID],
    });

    vi.useRealTimers();
  });

  it('onError restores previous query data when publish fails', async () => {
    const { queryClient, Wrapper } = createHarness();
    const queryKey = ['nostr', 'comments', VIDEO_ID, 50] as const;
    const snapshot = {
      allComments: [existingComment('keep-me')],
      topLevelComments: [existingComment('keep-me')],
    };

    queryClient.setQueryData(queryKey, snapshot);

    publishAsync.mockRejectedValueOnce(new Error('relay rejected'));

    const { result } = renderHook(() => usePostComment(), { wrapper: Wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          root: videoRoot(),
          content: 'Fails',
        })
      ).rejects.toThrow('relay rejected');
    });

    expect(queryClient.getQueryData(queryKey)).toEqual(snapshot);
  });
});
