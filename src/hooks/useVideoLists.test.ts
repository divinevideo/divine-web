// ABOUTME: Tests for useVideoLists hooks and list query/mutation behaviour

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { NostrEvent } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND } from '@/types/video';
import type { VideoList } from '@/lib/parseVideoListFromEvent';

const mockNostrQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

const mockPublishAsync = vi.fn().mockResolvedValue({
  id: 'e'.repeat(64),
  kind: 30005,
  pubkey: 'a'.repeat(64),
  tags: [],
  content: '',
  sig: 's'.repeat(128),
  created_at: 1,
});

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: mockPublishAsync,
    mutate: mockPublishAsync,
  }),
}));

const TEST_PUBKEY = 'a'.repeat(64);
const OTHER_PUBKEY = 'f'.repeat(64);

const mockUseCurrentUser = vi.fn();

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

function createWrapper(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

function listEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  const coord = `${SHORT_VIDEO_KIND}:${TEST_PUBKEY}:vid-1`;
  return {
    id: '1'.repeat(64),
    pubkey: TEST_PUBKEY,
    kind: 30005,
    created_at: 2000,
    tags: [
      ['d', 'my-list'],
      ['title', 'Cool list'],
      ['a', coord],
    ],
    content: '',
    sig: 's'.repeat(128),
    ...overrides,
  };
}

describe('useVideoLists hooks', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mockNostrQuery.mockResolvedValue([]);
    mockPublishAsync.mockResolvedValue({
      id: 'e'.repeat(64),
      kind: 30005,
      pubkey: TEST_PUBKEY,
      tags: [],
      content: '',
      sig: 's'.repeat(128),
      created_at: 1,
    });
    mockUseCurrentUser.mockReturnValue({
      user: { pubkey: TEST_PUBKEY },
      signer: { signEvent: vi.fn() },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useVideoLists', () => {
    it('queries kind 30005 with authors when explicit pubkey is passed', async () => {
      const { useVideoLists } = await import('./useVideoLists');
      mockNostrQuery.mockResolvedValue([listEvent({ created_at: 100 }), listEvent({ created_at: 300, tags: [['d', 'l2'], ['title', 'Second'], ['a', `${SHORT_VIDEO_KIND}:${TEST_PUBKEY}:v2`]] })]);

      const { result } = renderHook(() => useVideoLists(OTHER_PUBKEY), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockNostrQuery).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            kinds: [30005],
            authors: [OTHER_PUBKEY],
            limit: 100,
          }),
        ],
        expect.any(Object)
      );

      const lists = result.current.data ?? [];
      expect(lists.map((l) => l.id)).toEqual(['l2', 'my-list']);
    });

    it('uses current user pubkey in filter when hook arg is omitted', async () => {
      const { useVideoLists } = await import('./useVideoLists');
      mockNostrQuery.mockResolvedValue([listEvent()]);

      const { result } = renderHook(() => useVideoLists(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockNostrQuery).toHaveBeenCalledWith(
        [expect.objectContaining({ authors: [TEST_PUBKEY] })],
        expect.any(Object)
      );
    });

    it('runs browse-all query when no pubkey arg and no logged-in user', async () => {
      mockUseCurrentUser.mockReturnValue({ user: null, signer: null });
      const { useVideoLists } = await import('./useVideoLists');
      mockNostrQuery.mockResolvedValue([]);

      const { result } = renderHook(() => useVideoLists(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockNostrQuery).toHaveBeenCalledWith(
        [expect.objectContaining({ kinds: [30005], limit: 100 })],
        expect.any(Object)
      );
      const filter = mockNostrQuery.mock.calls[0][0][0] as { authors?: string[] };
      expect(filter.authors).toBeUndefined();
    });
  });

  describe('useVideosInLists', () => {
    it('uses #a filter and is disabled without videoId', async () => {
      const { useVideosInLists } = await import('./useVideoLists');

      const { result: disabled } = renderHook(() => useVideosInLists(undefined), {
        wrapper: createWrapper(),
      });
      expect(disabled.current.fetchStatus).toBe('idle');

      mockNostrQuery.mockResolvedValue([]);
      const { result } = renderHook(() => useVideosInLists('my-dtag'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isFetched).toBe(true));

      expect(mockNostrQuery).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            kinds: [30005],
            '#a': [`${SHORT_VIDEO_KIND}:*:my-dtag`],
            limit: 100,
          }),
        ],
        expect.any(Object)
      );
    });
  });

  describe('useCreateVideoList', () => {
    it('throws when not logged in', async () => {
      mockUseCurrentUser.mockReturnValue({ user: null, signer: null });
      const { useCreateVideoList } = await import('./useVideoLists');
      const { result } = renderHook(() => useCreateVideoList(), { wrapper: createWrapper() });

      await expect(
        result.current.mutateAsync({
          id: 'new',
          name: 'N',
          videoCoordinates: [],
        })
      ).rejects.toThrow('Must be logged in to create lists');
      expect(mockPublishAsync).not.toHaveBeenCalled();
    });

    it('publishes kind 30005 with expected tags on success', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      const wrapper = createWrapper(queryClient);
      const { useCreateVideoList } = await import('./useVideoLists');
      const { useVideoLists } = await import('./useVideoLists');

      mockNostrQuery.mockResolvedValue([]);

      const videoLists = renderHook(() => useVideoLists(TEST_PUBKEY), { wrapper });
      await waitFor(() => expect(videoLists.result.current.isSuccess).toBe(true));

      const create = renderHook(() => useCreateVideoList(), { wrapper });

      await create.result.current.mutateAsync({
        id: 'new-list',
        name: 'Fresh',
        description: 'D',
        image: 'https://img',
        videoCoordinates: [`${SHORT_VIDEO_KIND}:${TEST_PUBKEY}:a`],
        tags: ['x', 'y'],
        isCollaborative: true,
        allowedCollaborators: [OTHER_PUBKEY],
        thumbnailEventId: 'thumb1',
        playOrder: 'shuffle',
      });

      expect(mockPublishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 30005,
          content: '',
          tags: expect.arrayContaining([
            ['d', 'new-list'],
            ['title', 'Fresh'],
            ['description', 'D'],
            ['image', 'https://img'],
            ['t', 'x'],
            ['t', 'y'],
            ['collaborative', 'true'],
            ['collaborator', OTHER_PUBKEY],
            ['thumbnail-event', 'thumb1'],
            ['play-order', 'shuffle'],
            ['a', `${SHORT_VIDEO_KIND}:${TEST_PUBKEY}:a`],
          ]),
        })
      );

      await waitFor(() => expect(videoLists.result.current.isFetching).toBe(false));
    });

    it('omits play-order tag when playOrder is chronological or omitted', async () => {
      const { useCreateVideoList } = await import('./useVideoLists');
      const { result } = renderHook(() => useCreateVideoList(), { wrapper: createWrapper() });

      mockPublishAsync.mockClear();
      await result.current.mutateAsync({
        id: 'chron',
        name: 'Chron',
        videoCoordinates: [],
        playOrder: 'chronological',
      });
      let tags = (mockPublishAsync.mock.calls[0][0] as { tags: string[][] }).tags;
      expect(tags.find((t) => t[0] === 'play-order')).toBeUndefined();

      mockPublishAsync.mockClear();
      await result.current.mutateAsync({
        id: 'default-order',
        name: 'Default',
        videoCoordinates: [],
      });
      tags = (mockPublishAsync.mock.calls[0][0] as { tags: string[][] }).tags;
      expect(tags.find((t) => t[0] === 'play-order')).toBeUndefined();
    });

    it('prepends new list to video-lists cache on success (before refetch)', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
      const wrapper = createWrapper(queryClient);
      mockNostrQuery.mockResolvedValue([]);

      const { useCreateVideoList } = await import('./useVideoLists');
      const { useVideoLists } = await import('./useVideoLists');

      const lists = renderHook(() => useVideoLists(TEST_PUBKEY), { wrapper });
      await waitFor(() => expect(lists.result.current.isSuccess).toBe(true));

      const create = renderHook(() => useCreateVideoList(), { wrapper });
      await create.result.current.mutateAsync({
        id: 'cache-list',
        name: 'Cached',
        videoCoordinates: [`${SHORT_VIDEO_KIND}:${TEST_PUBKEY}:coord-z`],
      });

      const cached = queryClient.getQueryData<VideoList[]>(['video-lists', TEST_PUBKEY]);
      expect(cached?.[0]?.id).toBe('cache-list');
      expect(cached?.some((l) => l.id === 'cache-list')).toBe(true);
    });
  });

  describe('useAddVideoToList', () => {
    it('returns without publishing when video already in list', async () => {
      const coord = `${SHORT_VIDEO_KIND}:${TEST_PUBKEY}:vid-1`;
      mockNostrQuery.mockResolvedValue([listEvent()]);
      const { useAddVideoToList } = await import('./useVideoLists');
      const { result } = renderHook(() => useAddVideoToList(), { wrapper: createWrapper() });

      mockPublishAsync.mockClear();
      await result.current.mutateAsync({
        listId: 'my-list',
        videoCoordinate: coord,
      });

      expect(mockPublishAsync).not.toHaveBeenCalled();
    });

    it('throws when list not found', async () => {
      mockNostrQuery.mockResolvedValue([]);
      const { useAddVideoToList } = await import('./useVideoLists');
      const { result } = renderHook(() => useAddVideoToList(), { wrapper: createWrapper() });

      await expect(
        result.current.mutateAsync({
          listId: 'missing',
          videoCoordinate: `${SHORT_VIDEO_KIND}:${TEST_PUBKEY}:x`,
        })
      ).rejects.toThrow('List not found');
    });

    it('throws when list event cannot be parsed', async () => {
      mockNostrQuery.mockResolvedValue([
        listEvent({ tags: [['title', 'no-d-tag']] }),
      ]);
      const { useAddVideoToList } = await import('./useVideoLists');
      const { result } = renderHook(() => useAddVideoToList(), { wrapper: createWrapper() });

      await expect(
        result.current.mutateAsync({
          listId: 'irrelevant',
          videoCoordinate: `${SHORT_VIDEO_KIND}:${TEST_PUBKEY}:x`,
        })
      ).rejects.toThrow('Invalid list format');
    });

    it('publishes kind 30005 with existing and new video coordinates', async () => {
      const existing = `${SHORT_VIDEO_KIND}:${TEST_PUBKEY}:vid-1`;
      const incoming = `${SHORT_VIDEO_KIND}:${TEST_PUBKEY}:new-vid`;
      mockNostrQuery.mockResolvedValue([
        listEvent({
          tags: [
            ['d', 'my-list'],
            ['title', 'Cool list'],
            ['description', 'About'],
            ['image', 'https://cover.example/img.jpg'],
            ['a', existing],
          ],
        }),
      ]);
      const { useAddVideoToList } = await import('./useVideoLists');
      const { result } = renderHook(() => useAddVideoToList(), { wrapper: createWrapper() });

      mockPublishAsync.mockClear();
      await result.current.mutateAsync({
        listId: 'my-list',
        videoCoordinate: incoming,
      });

      expect(mockPublishAsync).toHaveBeenCalledTimes(1);
      const payload = mockPublishAsync.mock.calls[0][0] as { kind: number; tags: string[][] };
      expect(payload.kind).toBe(30005);
      const { tags } = payload;
      expect(tags).toContainEqual(['d', 'my-list']);
      expect(tags).toContainEqual(['title', 'Cool list']);
      expect(tags).toContainEqual(['description', 'About']);
      expect(tags).toContainEqual(['image', 'https://cover.example/img.jpg']);
      expect(tags.filter((t) => t[0] === 'a').map((t) => t[1])).toEqual([existing, incoming]);
    });
  });

  describe('useRemoveVideoFromList', () => {
    it('throws when list not found', async () => {
      mockNostrQuery.mockResolvedValue([]);
      const { useRemoveVideoFromList } = await import('./useVideoLists');
      const { result } = renderHook(() => useRemoveVideoFromList(), { wrapper: createWrapper() });

      await expect(
        result.current.mutateAsync({
          listId: 'x',
          videoCoordinate: `${SHORT_VIDEO_KIND}:${TEST_PUBKEY}:v`,
        })
      ).rejects.toThrow('List not found');
    });

    it('throws when list event cannot be parsed', async () => {
      mockNostrQuery.mockResolvedValue([listEvent({ tags: [['title', 'bad']] })]);
      const { useRemoveVideoFromList } = await import('./useVideoLists');
      const { result } = renderHook(() => useRemoveVideoFromList(), { wrapper: createWrapper() });

      await expect(
        result.current.mutateAsync({
          listId: 'any',
          videoCoordinate: `${SHORT_VIDEO_KIND}:${TEST_PUBKEY}:v`,
        })
      ).rejects.toThrow('Invalid list format');
    });

    it('rebuilds tags preserving metadata when removing a video', async () => {
      const coord1 = `${SHORT_VIDEO_KIND}:${TEST_PUBKEY}:v1`;
      const coord2 = `${SHORT_VIDEO_KIND}:${TEST_PUBKEY}:v2`;
      const ev = listEvent({
        tags: [
          ['d', 'my-list'],
          ['title', 'Cool list'],
          ['description', 'Desc'],
          ['image', 'https://i'],
          ['t', 'tag1'],
          ['collaborative', 'true'],
          ['collaborator', OTHER_PUBKEY],
          ['thumbnail-event', 'th'],
          ['play-order', 'reverse'],
          ['a', coord1],
          ['a', coord2],
        ],
      });
      mockNostrQuery.mockResolvedValue([ev]);
      const { useRemoveVideoFromList } = await import('./useVideoLists');
      const { result } = renderHook(() => useRemoveVideoFromList(), { wrapper: createWrapper() });

      mockPublishAsync.mockClear();
      await result.current.mutateAsync({
        listId: 'my-list',
        videoCoordinate: coord1,
      });

      expect(mockPublishAsync).toHaveBeenCalledTimes(1);
      const payload = mockPublishAsync.mock.calls[0][0] as { tags: string[][] };
      const tags = payload.tags;
      expect(tags).toContainEqual(['d', 'my-list']);
      expect(tags).toContainEqual(['title', 'Cool list']);
      expect(tags).toContainEqual(['description', 'Desc']);
      expect(tags).toContainEqual(['image', 'https://i']);
      expect(tags).toContainEqual(['t', 'tag1']);
      expect(tags).toContainEqual(['collaborative', 'true']);
      expect(tags).toContainEqual(['collaborator', OTHER_PUBKEY]);
      expect(tags).toContainEqual(['thumbnail-event', 'th']);
      expect(tags).toContainEqual(['play-order', 'reverse']);
      expect(tags.filter((t) => t[0] === 'a').map((t) => t[1])).toEqual([coord2]);
    });
  });

  describe('useDeleteVideoList', () => {
    it('publishes kind 5 deletion with addressable a tag', async () => {
      const { useDeleteVideoList } = await import('./useVideoLists');
      const { result } = renderHook(() => useDeleteVideoList(), { wrapper: createWrapper() });

      await result.current.mutateAsync({ listId: 'to-delete' });

      expect(mockPublishAsync).toHaveBeenCalledWith({
        kind: 5,
        content: 'List deleted by owner',
        tags: [['a', `30005:${TEST_PUBKEY}:to-delete`]],
      });
    });

    it('removes list from video-lists cache on success', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
      const wrapper = createWrapper(queryClient);

      queryClient.setQueryData<VideoList[]>(['video-lists', TEST_PUBKEY], [
        {
          id: 'keep',
          name: 'Keep',
          pubkey: TEST_PUBKEY,
          createdAt: 1,
          videoCoordinates: [],
          public: true,
        },
        {
          id: 'del-me',
          name: 'Delete',
          pubkey: TEST_PUBKEY,
          createdAt: 2,
          videoCoordinates: [],
          public: true,
        },
      ]);

      const { useDeleteVideoList } = await import('./useVideoLists');
      const { result } = renderHook(() => useDeleteVideoList(), { wrapper });

      mockPublishAsync.mockClear();
      await result.current.mutateAsync({ listId: 'del-me' });

      const data = queryClient.getQueryData<VideoList[]>(['video-lists', TEST_PUBKEY]);
      expect(data?.map((l) => l.id)).toEqual(['keep']);
    });
  });

  describe('useTrendingVideoLists', () => {
    it('filters by since window and drops lists with no videos', async () => {
      const { useTrendingVideoLists } = await import('./useVideoLists');
      const emptyCoords = listEvent({
        tags: [['d', 'empty'], ['title', 'E']],
      });
      const withCoords = listEvent({ created_at: 9_999_999 });
      mockNostrQuery.mockResolvedValue([emptyCoords, withCoords]);

      const { result } = renderHook(() => useTrendingVideoLists(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockNostrQuery).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            kinds: [30005],
            limit: 50,
            since: expect.any(Number) as number,
          }),
        ],
        expect.any(Object)
      );
      const since = (mockNostrQuery.mock.calls[0][0][0] as { since: number }).since;
      expect(since).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));

      const ids = (result.current.data ?? []).map((l) => l.id);
      expect(ids).toContain('my-list');
      expect(ids).not.toContain('empty');
    });
  });

  describe('useFollowedUsersLists', () => {
    it('returns empty array without querying when followed list is empty', async () => {
      const { useFollowedUsersLists } = await import('./useVideoLists');
      const { result } = renderHook(() => useFollowedUsersLists([]), { wrapper: createWrapper() });

      expect(result.current.fetchStatus).toBe('idle');
      expect(mockNostrQuery).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('queries at most 50 author pubkeys and filters empty video lists', async () => {
      const { useFollowedUsersLists } = await import('./useVideoLists');
      const pubkeys = Array.from({ length: 60 }, (_, i) => i.toString(16).padStart(64, '0'));
      const empty = listEvent({ pubkey: pubkeys[0], tags: [['d', 'e'], ['title', 'E']] });
      const full = listEvent({ pubkey: pubkeys[1], created_at: 5000 });
      mockNostrQuery.mockResolvedValue([empty, full]);

      const { result } = renderHook(() => useFollowedUsersLists(pubkeys), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockNostrQuery).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            kinds: [30005],
            authors: pubkeys.slice(0, 50),
            limit: 100,
          }),
        ],
        expect.any(Object)
      );
      expect((result.current.data ?? []).every((l) => l.videoCoordinates.length > 0)).toBe(true);
    });
  });
});
