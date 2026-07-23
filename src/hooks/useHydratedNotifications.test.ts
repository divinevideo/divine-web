// ABOUTME: Tests for useHydratedNotifications hook
// ABOUTME: Verifies profile hydration, video hydration, grouping logic, and paging delegation

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RawNotification, NotificationsResponse } from '@/types/notification';

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------
const { mockUseNotifications, mockUseBatchedAuthors, mockFetchVideoById } = vi.hoisted(() => ({
  mockUseNotifications: vi.fn(),
  mockUseBatchedAuthors: vi.fn(),
  mockFetchVideoById: vi.fn(),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: mockUseNotifications,
}));

vi.mock('@/hooks/useBatchedAuthors', () => ({
  useBatchedAuthors: mockUseBatchedAuthors,
}));

vi.mock('@/lib/funnelcakeClient', () => ({
  fetchVideoById: mockFetchVideoById,
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock('@/config/api', () => ({
  API_CONFIG: {
    funnelcake: {
      get baseUrl() {
        return 'https://api.divine.video';
      },
      timeout: 5000,
      endpoints: {},
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapperWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
  return { queryClient, wrapper };
}

function createWrapper() {
  return createWrapperWithClient().wrapper;
}

const PUBKEY_A = 'a'.repeat(64);
const PUBKEY_B = 'b'.repeat(64);
const VIDEO_ID = 'c'.repeat(64);
const VIDEO_ID_2 = 'd'.repeat(64);

function makeLike(
  id: string,
  actorPubkey: string,
  targetEventId: string,
  timestamp = 1000,
  isRead = false,
): RawNotification {
  return {
    id,
    type: 'like',
    actorPubkey,
    timestamp,
    isRead,
    targetEventId,
    sourceEventId: `src_${id}`,
    sourceKind: 7,
  };
}

function makeFollow(id: string, actorPubkey: string, timestamp = 1000): RawNotification {
  return {
    id,
    type: 'follow',
    actorPubkey,
    timestamp,
    isRead: false,
    sourceEventId: `src_${id}`,
    sourceKind: 3,
  };
}

function makeNotificationsPage(notifications: RawNotification[], unreadCount = 0): NotificationsResponse {
  return { notifications, unreadCount, hasMore: false };
}

function makeInfiniteQueryResult(pages: NotificationsResponse[], opts?: { isLoading?: boolean; isError?: boolean }) {
  return {
    data: { pages, pageParams: [undefined] },
    isLoading: opts?.isLoading ?? false,
    isError: opts?.isError ?? false,
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useHydratedNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no video metadata
    mockFetchVideoById.mockResolvedValue(null);

    // Default: empty author map
    mockUseBatchedAuthors.mockReturnValue({ data: {} });
  });

  it('groups two likes on one video into one row for category: all', async () => {
    const like1 = makeLike('like-1', PUBKEY_A, VIDEO_ID, 2000);
    const like2 = makeLike('like-2', PUBKEY_B, VIDEO_ID, 1000);

    mockUseNotifications.mockReturnValue(
      makeInfiniteQueryResult([makeNotificationsPage([like1, like2])]),
    );
    mockUseBatchedAuthors.mockReturnValue({ data: {} });
    mockFetchVideoById.mockResolvedValue(null);

    const { useHydratedNotifications } = await import('./useHydratedNotifications');

    const { result } = renderHook(
      () => useHydratedNotifications({ category: 'all' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(1);
    const item = result.current.items[0];
    expect(item.kind).toBe('video');
    if (item.kind === 'video') {
      expect(item.type).toBe('like');
      expect(item.totalCount).toBe(2);
      expect(item.videoEventId).toBe(VIDEO_ID);
    }
  });

  it('keeps two likes as separate singleton rows for category: unread', async () => {
    const like1 = makeLike('like-1', PUBKEY_A, VIDEO_ID, 2000);
    const like2 = makeLike('like-2', PUBKEY_B, VIDEO_ID, 1000);

    mockUseNotifications.mockReturnValue(
      makeInfiniteQueryResult([makeNotificationsPage([like1, like2])]),
    );
    mockUseBatchedAuthors.mockReturnValue({ data: {} });

    const { useHydratedNotifications } = await import('./useHydratedNotifications');

    const { result } = renderHook(
      () => useHydratedNotifications({ category: 'unread' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Each raw notification should produce its own item (singleton grouping)
    expect(result.current.items).toHaveLength(2);
    result.current.items.forEach((item) => {
      expect(item.kind).toBe('video');
      if (item.kind === 'video') {
        expect(item.totalCount).toBe(1);
      }
    });
  });

  it('maps profile metadata to displayName, avatarUrl, and nip05', async () => {
    const like = makeLike('like-1', PUBKEY_A, VIDEO_ID, 1000);

    mockUseNotifications.mockReturnValue(
      makeInfiniteQueryResult([makeNotificationsPage([like])]),
    );
    mockUseBatchedAuthors.mockReturnValue({
      data: {
        [PUBKEY_A]: {
          metadata: {
            display_name: 'Alice Display',
            name: 'alice',
            picture: 'https://example.com/alice.jpg',
            nip05: 'alice@divine.video',
          },
        },
      },
    });

    const { useHydratedNotifications } = await import('./useHydratedNotifications');

    const { result } = renderHook(
      () => useHydratedNotifications({ category: 'all' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(1);
    const item = result.current.items[0];
    expect(item.kind).toBe('video');
    if (item.kind === 'video') {
      const actor = item.actors[0];
      expect(actor.displayName).toBe('Alice Display');
      expect(actor.avatarUrl).toBe('https://example.com/alice.jpg');
      expect(actor.nip05).toBe('alice@divine.video');
    }
  });

  it('still returns notification row when fetchVideoById fails', async () => {
    const like = makeLike('like-1', PUBKEY_A, VIDEO_ID, 1000);

    mockUseNotifications.mockReturnValue(
      makeInfiniteQueryResult([makeNotificationsPage([like])]),
    );
    mockUseBatchedAuthors.mockReturnValue({ data: {} });
    mockFetchVideoById.mockRejectedValue(new Error('Network error'));

    const { useHydratedNotifications } = await import('./useHydratedNotifications');

    const { result } = renderHook(
      () => useHydratedNotifications({ category: 'all' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Notification row should still appear even with missing video metadata
    expect(result.current.items).toHaveLength(1);
    const item = result.current.items[0];
    expect(item.kind).toBe('video');
    if (item.kind === 'video') {
      expect(item.videoEventId).toBe(VIDEO_ID);
      expect(item.videoTitle).toBeUndefined();
      expect(item.videoThumbnailUrl).toBeUndefined();
    }
  });

  it('does not cache empty per-video metadata when hydration returns null', async () => {
    const like = makeLike('like-1', PUBKEY_A, VIDEO_ID, 1000);
    const { queryClient, wrapper } = createWrapperWithClient();

    mockUseNotifications.mockReturnValue(
      makeInfiniteQueryResult([makeNotificationsPage([like])]),
    );
    mockUseBatchedAuthors.mockReturnValue({ data: {} });
    mockFetchVideoById.mockResolvedValue(null);

    const { useHydratedNotifications } = await import('./useHydratedNotifications');

    const { result } = renderHook(
      () => useHydratedNotifications({ category: 'all' }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mockFetchVideoById).toHaveBeenCalledWith(
        'https://api.divine.video',
        VIDEO_ID,
        undefined,
        expect.any(AbortSignal),
      );
    });

    expect(queryClient.getQueryData(['notification-video', VIDEO_ID])).toBeUndefined();
    expect(result.current.items).toHaveLength(1);
  });

  it('exposes paging state and functions from useNotifications', async () => {
    const fetchNextPage = vi.fn();
    mockUseNotifications.mockReturnValue({
      data: { pages: [makeNotificationsPage([], 5)], pageParams: [undefined] },
      isLoading: false,
      isError: false,
      error: null,
      fetchNextPage,
      hasNextPage: true,
      isFetchingNextPage: true,
    });
    mockUseBatchedAuthors.mockReturnValue({ data: {} });

    const { useHydratedNotifications } = await import('./useHydratedNotifications');

    const { result } = renderHook(
      () => useHydratedNotifications({ category: 'all' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.isFetchingNextPage).toBe(true);
    expect(result.current.fetchNextPage).toBe(fetchNextPage);
    expect(result.current.unreadCount).toBe(5);
  });

  it('attaches video title and thumbnail from fetchVideoById when available', async () => {
    const like = makeLike('like-1', PUBKEY_A, VIDEO_ID, 1000);

    mockUseNotifications.mockReturnValue(
      makeInfiniteQueryResult([makeNotificationsPage([like])]),
    );
    mockUseBatchedAuthors.mockReturnValue({ data: {} });
    mockFetchVideoById.mockResolvedValue({
      id: VIDEO_ID,
      title: 'My Cool Video',
      thumbnail: 'https://example.com/thumb.jpg',
    });

    const { useHydratedNotifications } = await import('./useHydratedNotifications');

    const { result } = renderHook(
      () => useHydratedNotifications({ category: 'all' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      const item = result.current.items[0];
      if (item.kind === 'video') {
        expect(item.videoTitle).toBe('My Cool Video');
      }
    });

    const item = result.current.items[0];
    expect(item.kind).toBe('video');
    if (item.kind === 'video') {
      expect(item.videoTitle).toBe('My Cool Video');
      expect(item.videoThumbnailUrl).toBe('https://example.com/thumb.jpg');
    }
  });

  it('handles follow notifications as singleton actor rows', async () => {
    const follow = makeFollow('follow-1', PUBKEY_A, 1000);

    mockUseNotifications.mockReturnValue(
      makeInfiniteQueryResult([makeNotificationsPage([follow])]),
    );
    mockUseBatchedAuthors.mockReturnValue({
      data: {
        [PUBKEY_A]: {
          metadata: {
            name: 'alice',
          },
        },
      },
    });

    const { useHydratedNotifications } = await import('./useHydratedNotifications');

    const { result } = renderHook(
      () => useHydratedNotifications({ category: 'all' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(1);
    const item = result.current.items[0];
    expect(item.kind).toBe('actor');
    if (item.kind === 'actor') {
      expect(item.type).toBe('follow');
      expect(item.actor.pubkey).toBe(PUBKEY_A);
    }
  });

  it('groups likes on different videos into separate rows', async () => {
    const like1 = makeLike('like-1', PUBKEY_A, VIDEO_ID, 2000);
    const like2 = makeLike('like-2', PUBKEY_B, VIDEO_ID_2, 1000);

    mockUseNotifications.mockReturnValue(
      makeInfiniteQueryResult([makeNotificationsPage([like1, like2])]),
    );
    mockUseBatchedAuthors.mockReturnValue({ data: {} });

    const { useHydratedNotifications } = await import('./useHydratedNotifications');

    const { result } = renderHook(
      () => useHydratedNotifications({ category: 'all' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(2);
    const videoIds = result.current.items
      .filter((i) => i.kind === 'video')
      .map((i) => (i.kind === 'video' ? i.videoEventId : ''));
    expect(videoIds).toContain(VIDEO_ID);
    expect(videoIds).toContain(VIDEO_ID_2);
  });
});
