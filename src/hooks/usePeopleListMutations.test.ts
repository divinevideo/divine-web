import type { NostrEvent } from '@nostrify/nostrify';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PeopleList } from '@/lib/parsePeopleListFromEvent';

const mocks = vi.hoisted(() => ({
  nostrQuery: vi.fn(),
  publishEvent: vi.fn(),
  useCurrentUser: vi.fn(),
}));

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mocks.nostrQuery,
    },
  }),
}));

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: mocks.publishEvent,
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mocks.useCurrentUser(),
}));

const OWNER = 'a'.repeat(64);
const ALICE = 'b'.repeat(64);
const BOB = 'c'.repeat(64);
const PRIVATE_CONTENT = 'encrypted-private-members';

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
    created_at: 2000,
    tags: [
      ['d', 'friends'],
      ['title', 'Friends'],
      ['description', 'Good people'],
      ['p', ALICE],
    ],
    content: PRIVATE_CONTENT,
    sig: 's'.repeat(128),
    ...overrides,
  };
}

function cachedList(overrides: Partial<PeopleList> = {}): PeopleList {
  return {
    id: 'friends',
    name: 'Friends',
    description: 'Good people',
    pubkey: OWNER,
    createdAt: 2000,
    memberPubkeys: [ALICE],
    ...overrides,
  };
}

describe('usePeopleListMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCurrentUser.mockReturnValue({ user: { pubkey: OWNER } });
    mocks.nostrQuery.mockResolvedValue([peopleListEvent()]);
    mocks.publishEvent.mockResolvedValue({
      id: '2'.repeat(64),
      pubkey: OWNER,
      kind: 30000,
      created_at: 3000,
      tags: [],
      content: '',
      sig: 's'.repeat(128),
    });
  });

  it('creates a kind 30000 people list with a slug d-tag and p tags', async () => {
    const { useCreatePeopleList } = await import('./usePeopleListMutations');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useCreatePeopleList(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      name: 'Cool People!',
      description: 'Good loops',
      memberPubkeys: [ALICE, ALICE, BOB],
    });

    expect(mocks.publishEvent).toHaveBeenCalledWith({
      kind: 30000,
      content: '',
      tags: [
        ['d', 'cool-people'],
        ['title', 'Cool People!'],
        ['description', 'Good loops'],
        ['p', ALICE],
        ['p', BOB],
      ],
    });
    expect(queryClient.getQueryData<PeopleList[]>(['people-lists', OWNER])?.[0]).toMatchObject({
      id: 'cool-people',
      memberPubkeys: [ALICE, BOB],
    });
  });

  it('preserves event content when updating people-list metadata', async () => {
    const { useUpdatePeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useUpdatePeopleList(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      ownerPubkey: OWNER,
      listId: 'friends',
      name: 'Best people',
      description: '',
      image: 'https://cdn.example.com/list.jpg',
    });

    expect(mocks.publishEvent).toHaveBeenCalledWith({
      kind: 30000,
      content: PRIVATE_CONTENT,
      tags: [
        ['d', 'friends'],
        ['title', 'Best people'],
        ['image', 'https://cdn.example.com/list.jpg'],
        ['p', ALICE],
      ],
    });
  });

  it('preserves event content when adding and removing people', async () => {
    const { useAddPersonToPeopleList, useRemovePersonFromPeopleList } = await import('./usePeopleListMutations');
    const { result: addResult } = renderHook(() => useAddPersonToPeopleList(), {
      wrapper: createWrapper(),
    });
    await addResult.current.mutateAsync({
      ownerPubkey: OWNER,
      listId: 'friends',
      memberPubkey: BOB,
    });

    expect(mocks.publishEvent).toHaveBeenLastCalledWith({
      kind: 30000,
      content: PRIVATE_CONTENT,
      tags: [
        ['d', 'friends'],
        ['title', 'Friends'],
        ['description', 'Good people'],
        ['p', ALICE],
        ['p', BOB],
      ],
    });

    mocks.nostrQuery.mockResolvedValueOnce([
      peopleListEvent({
        tags: [
          ['d', 'friends'],
          ['title', 'Friends'],
          ['p', ALICE],
          ['p', BOB],
        ],
      }),
    ]);
    const { result: removeResult } = renderHook(() => useRemovePersonFromPeopleList(), {
      wrapper: createWrapper(),
    });
    await removeResult.current.mutateAsync({
      ownerPubkey: OWNER,
      listId: 'friends',
      memberPubkey: ALICE,
    });

    expect(mocks.publishEvent).toHaveBeenLastCalledWith({
      kind: 30000,
      content: PRIVATE_CONTENT,
      tags: [
        ['d', 'friends'],
        ['title', 'Friends'],
        ['p', BOB],
      ],
    });
  });

  it('rolls back optimistic people-list member updates when publish fails', async () => {
    const { useAddPersonToPeopleList } = await import('./usePeopleListMutations');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(['people-list', OWNER, 'friends'], cachedList());
    queryClient.setQueryData(['people-lists', OWNER], [cachedList()]);
    mocks.publishEvent.mockRejectedValueOnce(new Error('relay refused'));

    const { result } = renderHook(() => useAddPersonToPeopleList(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current.mutateAsync({
      ownerPubkey: OWNER,
      listId: 'friends',
      memberPubkey: BOB,
    })).rejects.toThrow('relay refused');

    await waitFor(() => {
      expect(queryClient.getQueryData<PeopleList>(['people-list', OWNER, 'friends'])?.memberPubkeys).toEqual([ALICE]);
      expect(queryClient.getQueryData<PeopleList[]>(['people-lists', OWNER])?.[0].memberPubkeys).toEqual([ALICE]);
    });
  });

  it('publishes deletion events with address and kind tags and enforces owner', async () => {
    const { useDeletePeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useDeletePeopleList(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({ ownerPubkey: OWNER, listId: 'friends' });

    expect(mocks.publishEvent).toHaveBeenCalledWith({
      kind: 5,
      content: 'People list deleted by owner',
      tags: [
        ['a', `30000:${OWNER}:friends`],
        ['k', '30000'],
      ],
    });

    await expect(result.current.mutateAsync({
      ownerPubkey: BOB,
      listId: 'friends',
    })).rejects.toThrow('Only the list owner can update this people list');
  });
});
