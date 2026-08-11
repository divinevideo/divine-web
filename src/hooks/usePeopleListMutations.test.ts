import type { NostrEvent } from '@nostrify/nostrify';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
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

describe('usePeopleListMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCurrentUser.mockReturnValue({ user: { pubkey: OWNER } });
    mocks.nostrQuery.mockResolvedValue([]);
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
      memberPubkeys: [ALICE, ALICE],
    });

    expect(mocks.nostrQuery).toHaveBeenCalledWith(
      [{
        kinds: [30000],
        authors: [OWNER],
        '#d': ['cool-people'],
        limit: 1,
      }],
      { signal: expect.any(AbortSignal) },
    );
    expect(mocks.publishEvent).toHaveBeenCalledWith({
      kind: 30000,
      content: '',
      tags: [
        ['d', 'cool-people'],
        ['title', 'Cool People!'],
        ['description', 'Good loops'],
        ['p', ALICE],
      ],
    });
    expect(queryClient.getQueryData<PeopleList[]>(['people-lists', OWNER])?.[0]).toMatchObject({
      id: 'cool-people',
      memberPubkeys: [ALICE],
    });
  });

  it('refuses to replace an existing people list with the same slug', async () => {
    mocks.nostrQuery.mockResolvedValueOnce([
      peopleListEvent({
        tags: [
          ['d', 'cool-people'],
          ['title', 'Cool People'],
        ],
      }),
    ]);
    const { useCreatePeopleList } = await import('./usePeopleListMutations');
    const { result } = renderHook(() => useCreatePeopleList(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync({ name: 'Cool People!' })).rejects.toThrow(
      'A people list with that name already exists',
    );
    expect(mocks.publishEvent).not.toHaveBeenCalled();
  });

  it('preserves event content when updating people-list metadata', async () => {
    mocks.nostrQuery.mockResolvedValueOnce([peopleListEvent()]);
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
