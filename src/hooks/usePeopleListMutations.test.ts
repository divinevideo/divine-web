// ABOUTME: Tests for NIP-51 people-list mutation hooks preserving replaceable event content

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PeopleList } from '@/lib/parsePeopleListFromEvent';

const mockNostrQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

const mockPublishAsync = vi.fn();
vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: mockPublishAsync,
  }),
}));

const mockUseCurrentUser = vi.fn();
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

const OWNER = 'a'.repeat(64);
const ALICE = 'b'.repeat(64);
const BOB = 'c'.repeat(64);
const CAROL = 'd'.repeat(64);

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

function peopleListEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: '1'.repeat(64),
    pubkey: OWNER,
    kind: 30000,
    created_at: 200,
    tags: [
      ['d', 'friends'],
      ['title', 'Friends'],
      ['description', 'Good people'],
      ['p', ALICE, 'wss://relay.example'],
      ['p', BOB],
      ['custom', 'keep-me'],
    ],
    content: 'encrypted-private-members',
    sig: 'e'.repeat(128),
    ...overrides,
  };
}

function cachedList(overrides: Partial<PeopleList> = {}): PeopleList {
  return {
    id: 'friends',
    name: 'Friends',
    description: 'Good people',
    pubkey: OWNER,
    createdAt: 200,
    memberPubkeys: [ALICE, BOB],
    ...overrides,
  };
}

describe('usePeopleListMutations', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockUseCurrentUser.mockReturnValue({
      user: { pubkey: OWNER },
      signer: { signEvent: vi.fn() },
    });
    mockNostrQuery.mockResolvedValue([peopleListEvent()]);
    mockPublishAsync.mockResolvedValue({
      id: '2'.repeat(64),
      pubkey: OWNER,
      kind: 30000,
      created_at: 201,
      tags: [],
      content: '',
      sig: 'f'.repeat(128),
    });
  });

  it('creates a new people list with empty content', async () => {
    mockNostrQuery.mockResolvedValue([]);
    const { useCreatePeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useCreatePeopleList(), { wrapper: createWrapper() });

    await result.current.mutateAsync({
      id: 'makers',
      name: 'Makers',
      description: 'People making things',
      memberPubkeys: [ALICE, ALICE, BOB],
    });

    expect(mockPublishAsync).toHaveBeenCalledWith({
      kind: 30000,
      content: '',
      tags: [
        ['d', 'makers'],
        ['title', 'Makers'],
        ['description', 'People making things'],
        ['p', ALICE],
        ['p', BOB],
      ],
    });
  });

  it('refuses to create with invalid member pubkeys', async () => {
    mockNostrQuery.mockResolvedValue([]);
    const { useCreatePeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useCreatePeopleList(), { wrapper: createWrapper() });

    await expect(
      result.current.mutateAsync({
        id: 'makers',
        name: 'Makers',
        memberPubkeys: [ALICE, 'not-a-pubkey'],
      }),
    ).rejects.toThrow('Invalid member pubkey');
    expect(mockNostrQuery).not.toHaveBeenCalled();
    expect(mockPublishAsync).not.toHaveBeenCalled();
  });

  it('refuses to create a reserved people list', async () => {
    const { useCreatePeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useCreatePeopleList(), { wrapper: createWrapper() });

    await expect(result.current.mutateAsync({ id: 'block', name: 'Block' })).rejects.toThrow(
      'That list name is reserved',
    );
    expect(mockNostrQuery).not.toHaveBeenCalled();
    expect(mockPublishAsync).not.toHaveBeenCalled();
  });

  it.each(['', '   '])('refuses to create a people list with blank id %j', async (id) => {
    const { useCreatePeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useCreatePeopleList(), { wrapper: createWrapper() });

    await expect(result.current.mutateAsync({ id, name: 'Blank' })).rejects.toThrow(
      'List id is required',
    );
    expect(mockNostrQuery).not.toHaveBeenCalled();
    expect(mockPublishAsync).not.toHaveBeenCalled();
  });

  it('refuses to create over an existing people list coordinate', async () => {
    mockNostrQuery.mockResolvedValue([peopleListEvent({ content: 'keep-me' })]);
    const { useCreatePeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useCreatePeopleList(), { wrapper: createWrapper() });

    await expect(result.current.mutateAsync({ id: 'friends', name: 'Friends' })).rejects.toThrow(
      'People list already exists',
    );
    expect(mockPublishAsync).not.toHaveBeenCalled();
  });

  it('preserves current event content when updating metadata', async () => {
    const { useUpdatePeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useUpdatePeopleList(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ listId: 'friends', name: 'Best friends' });

    expect(mockPublishAsync).toHaveBeenCalledWith({
      kind: 30000,
      content: 'encrypted-private-members',
      tags: [
        ['d', 'friends'],
        ['title', 'Best friends'],
        ['description', 'Good people'],
        ['p', ALICE, 'wss://relay.example'],
        ['p', BOB],
        ['custom', 'keep-me'],
      ],
    });
  });

  it('uses the lowest event id when current events have the same created_at', async () => {
    mockNostrQuery.mockResolvedValue([
      peopleListEvent({
        id: 'f'.repeat(64),
        tags: [['d', 'friends'], ['title', 'High id']],
        content: 'high-id-content',
      }),
      peopleListEvent({
        id: '0'.repeat(64),
        tags: [['d', 'friends'], ['title', 'Low id']],
        content: 'low-id-content',
      }),
    ]);
    const { useUpdatePeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useUpdatePeopleList(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ listId: 'friends', description: 'Tie broken' });

    expect(mockPublishAsync).toHaveBeenCalledWith({
      kind: 30000,
      content: 'low-id-content',
      tags: [
        ['d', 'friends'],
        ['description', 'Tie broken'],
        ['title', 'Low id'],
      ],
    });
  });

  it('preserves current event content and existing p-tag extras when adding a member', async () => {
    const { useAddToPeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useAddToPeopleList(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ listId: 'friends', memberPubkey: CAROL });

    expect(mockPublishAsync).toHaveBeenCalledWith({
      kind: 30000,
      content: 'encrypted-private-members',
      tags: [
        ['d', 'friends'],
        ['title', 'Friends'],
        ['description', 'Good people'],
        ['custom', 'keep-me'],
        ['p', ALICE, 'wss://relay.example'],
        ['p', BOB],
        ['p', CAROL],
      ],
    });
  });

  it('preserves unknown p tags from other clients when changing members', async () => {
    mockNostrQuery.mockResolvedValue([
      peopleListEvent({
        tags: [
          ['d', 'friends'],
          ['p', ALICE],
          ['p', 'not-a-hex-pubkey'],
        ],
      }),
    ]);
    const { useAddToPeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useAddToPeopleList(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ listId: 'friends', memberPubkey: CAROL });

    expect(mockPublishAsync).toHaveBeenCalledWith({
      kind: 30000,
      content: 'encrypted-private-members',
      tags: [
        ['d', 'friends'],
        ['p', 'not-a-hex-pubkey'],
        ['p', ALICE],
        ['p', CAROL],
      ],
    });
  });

  it('preserves current event content when removing a member', async () => {
    const { useRemoveFromPeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useRemoveFromPeopleList(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ listId: 'friends', memberPubkey: BOB });

    expect(mockPublishAsync).toHaveBeenCalledWith({
      kind: 30000,
      content: 'encrypted-private-members',
      tags: [
        ['d', 'friends'],
        ['title', 'Friends'],
        ['description', 'Good people'],
        ['custom', 'keep-me'],
        ['p', ALICE, 'wss://relay.example'],
      ],
    });
  });

  it('refuses member mutations when the current event cannot be fetched', async () => {
    mockNostrQuery.mockResolvedValue([]);
    const { useAddToPeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useAddToPeopleList(), { wrapper: createWrapper() });

    await expect(result.current.mutateAsync({ listId: 'friends', memberPubkey: CAROL })).rejects.toThrow(
      'People list not found',
    );
    expect(mockPublishAsync).not.toHaveBeenCalled();
  });

  it('refuses updates when the current event cannot be parsed', async () => {
    mockNostrQuery.mockResolvedValue([peopleListEvent({ tags: [['d', 'block']] })]);
    const { useUpdatePeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useUpdatePeopleList(), { wrapper: createWrapper() });

    await expect(result.current.mutateAsync({ listId: 'friends', name: 'Nope' })).rejects.toThrow(
      'Invalid people list event',
    );
    expect(mockPublishAsync).not.toHaveBeenCalled();
  });

  it('does not publish when add/remove would not change the list', async () => {
    const { useAddToPeopleList, useRemoveFromPeopleList } = await import('./usePeopleListMutations');
    const wrapper = createWrapper();
    const add = renderHook(() => useAddToPeopleList(), { wrapper });
    const remove = renderHook(() => useRemoveFromPeopleList(), { wrapper });

    await add.result.current.mutateAsync({ listId: 'friends', memberPubkey: ALICE });
    await remove.result.current.mutateAsync({ listId: 'friends', memberPubkey: CAROL });

    expect(mockPublishAsync).not.toHaveBeenCalled();
  });

  it('rolls back optimistic member updates when publish fails', async () => {
    mockPublishAsync.mockRejectedValue(new Error('relay failed'));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const previousList = cachedList();
    queryClient.setQueryData(['people-list', OWNER, 'friends'], previousList);
    queryClient.setQueryData(['people-lists', OWNER], [previousList]);

    const { useAddToPeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useAddToPeopleList(), { wrapper: createWrapper(queryClient) });

    await expect(result.current.mutateAsync({ listId: 'friends', memberPubkey: CAROL })).rejects.toThrow(
      'relay failed',
    );

    await waitFor(() => {
      expect(queryClient.getQueryData(['people-list', OWNER, 'friends'])).toEqual(previousList);
      expect(queryClient.getQueryData(['people-lists', OWNER])).toEqual([previousList]);
    });
  });

  it('applies metadata optimistically and rolls back when publish fails', async () => {
    mockPublishAsync.mockRejectedValue(new Error('relay failed'));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const previousList = cachedList();
    queryClient.setQueryData(['people-list', OWNER, 'friends'], previousList);
    queryClient.setQueryData(['people-lists', OWNER], [previousList]);

    const { useUpdatePeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useUpdatePeopleList(), { wrapper: createWrapper(queryClient) });

    await expect(result.current.mutateAsync({
      listId: 'friends',
      name: 'Best friends',
      description: '',
    })).rejects.toThrow('relay failed');

    await waitFor(() => {
      expect(queryClient.getQueryData(['people-list', OWNER, 'friends'])).toEqual(previousList);
      expect(queryClient.getQueryData(['people-lists', OWNER])).toEqual([previousList]);
    });
  });

  it('clears cleared metadata optimistically before the relay answers', async () => {
    let resolvePublish: (() => void) | undefined;
    mockPublishAsync.mockImplementation(() => new Promise<void>((resolve) => {
      resolvePublish = resolve;
    }));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(['people-list', OWNER, 'friends'], cachedList());

    const { useUpdatePeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useUpdatePeopleList(), { wrapper: createWrapper(queryClient) });

    const pending = result.current.mutateAsync({
      listId: 'friends',
      name: 'Best friends',
      description: '',
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(['people-list', OWNER, 'friends'])).toMatchObject({
        name: 'Best friends',
        description: undefined,
      });
    });

    resolvePublish?.();
    await pending;
  });

  it('publishes a deletion request for the list coordinate and drops it from the cache', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(['people-list', OWNER, 'friends'], cachedList());
    queryClient.setQueryData(['people-lists', OWNER], [cachedList(), cachedList({ id: 'makers' })]);

    const { useDeletePeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useDeletePeopleList(), { wrapper: createWrapper(queryClient) });

    await result.current.mutateAsync({ listId: 'friends' });

    expect(mockPublishAsync).toHaveBeenCalledWith({
      kind: 5,
      content: 'People list deleted by owner',
      tags: [
        ['a', `30000:${OWNER}:friends`],
        ['k', '30000'],
      ],
    });
    expect(queryClient.getQueryData(['people-list', OWNER, 'friends'])).toBeNull();
    expect(queryClient.getQueryData<PeopleList[]>(['people-lists', OWNER])?.map((list) => list.id)).toEqual([
      'makers',
    ]);
  });

  it('refuses to delete a people list when logged out', async () => {
    mockUseCurrentUser.mockReturnValue({ user: undefined, signer: undefined });

    const { useDeletePeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useDeletePeopleList(), { wrapper: createWrapper() });

    await expect(result.current.mutateAsync({ listId: 'friends' })).rejects.toThrow(
      'Must be logged in to delete people lists',
    );
    expect(mockPublishAsync).not.toHaveBeenCalled();
  });
});
