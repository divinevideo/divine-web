// ABOUTME: Tests for useAddToPeopleList and useRemoveFromPeopleList
// ABOUTME: Verifies optimistic updates, idempotency, rollback on error

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAddToPeopleList, useRemoveFromPeopleList } from './usePeopleListMutations';
import type { PeopleList } from '@/types/peopleList';

// --- mocks ---
const mockPublish = vi.fn();
vi.mock('./useNostrPublish', () => ({
  useNostrPublish: () => ({ mutateAsync: mockPublish }),
}));

const USER_PK = 'a'.repeat(64);
let mockUser: { pubkey: string } | null = { pubkey: USER_PK };
vi.mock('./useCurrentUser', () => ({
  useCurrentUser: () => ({ user: mockUser }),
}));

const mockQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: { query: mockQuery } }),
}));

// --- constants ---
const MEMBER_A = 'b'.repeat(64);
const MEMBER_B = 'c'.repeat(64);
const NEW_MEMBER = 'd'.repeat(64);
const LIST_ID = 'test-list-1';

// --- helpers ---
function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { qc, Wrapper };
}

function makeListEvent(members: string[] = [MEMBER_A]) {
  return {
    id: 'event-id-1',
    pubkey: USER_PK,
    kind: 30000,
    created_at: 1_700_000_000,
    content: '',
    sig: 'sig',
    tags: [
      ['d', LIST_ID],
      ['title', 'My List'],
      ...members.map((m) => ['p', m]),
    ],
  };
}

// Seed a PeopleList into the query cache under the standard key
function seedCache(qc: QueryClient, members: string[]) {
  const list: PeopleList = {
    id: LIST_ID,
    pubkey: USER_PK,
    name: 'My List',
    members,
    createdAt: 1_700_000_000,
  };
  qc.setQueryData(['people-list', USER_PK, LIST_ID], list);
  return list;
}

// --- tests ---

describe('useAddToPeopleList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { pubkey: USER_PK };
  });

  it('adds a new member — publishes kind 30000 with original + new p tags', async () => {
    mockQuery.mockResolvedValue([makeListEvent([MEMBER_A])]);
    mockPublish.mockResolvedValue(undefined);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAddToPeopleList(), { wrapper: Wrapper });

    await act(() => result.current.mutateAsync({ listId: LIST_ID, memberPubkey: NEW_MEMBER }));

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const evt = mockPublish.mock.calls[0][0];

    expect(evt.kind).toBe(30000);
    expect(evt.content).toBe('');

    const pTags = evt.tags.filter((t: string[]) => t[0] === 'p');
    expect(pTags).toHaveLength(2);
    expect(pTags).toContainEqual(['p', MEMBER_A]);
    expect(pTags).toContainEqual(['p', NEW_MEMBER]);

    // NEW_MEMBER is appended last
    expect(pTags[pTags.length - 1]).toEqual(['p', NEW_MEMBER]);
  });

  it('is idempotent — does not publish when member already in list', async () => {
    mockQuery.mockResolvedValue([makeListEvent([MEMBER_A, MEMBER_B])]);
    mockPublish.mockResolvedValue(undefined);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAddToPeopleList(), { wrapper: Wrapper });

    await act(() => result.current.mutateAsync({ listId: LIST_ID, memberPubkey: MEMBER_A }));

    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('rolls back optimistic update when publishEvent throws', async () => {
    mockQuery.mockResolvedValue([makeListEvent([MEMBER_A])]);
    mockPublish.mockRejectedValue(new Error('relay down'));

    const { qc, Wrapper } = makeWrapper();
    // Seed the cache so the optimistic update has a starting point
    seedCache(qc, [MEMBER_A]);

    const { result } = renderHook(() => useAddToPeopleList(), { wrapper: Wrapper });

    await expect(
      act(() => result.current.mutateAsync({ listId: LIST_ID, memberPubkey: NEW_MEMBER })),
    ).rejects.toThrow('relay down');

    // Cache must be rolled back to original state
    const cached = qc.getQueryData<PeopleList>(['people-list', USER_PK, LIST_ID]);
    expect(cached?.members).toEqual([MEMBER_A]);
    expect(cached?.members).not.toContain(NEW_MEMBER);
  });
});

describe('useRemoveFromPeopleList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { pubkey: USER_PK };
  });

  it('removes a member — publishes kind 30000 without the removed p tag', async () => {
    mockQuery.mockResolvedValue([makeListEvent([MEMBER_A, MEMBER_B])]);
    mockPublish.mockResolvedValue(undefined);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useRemoveFromPeopleList(), { wrapper: Wrapper });

    await act(() => result.current.mutateAsync({ listId: LIST_ID, memberPubkey: MEMBER_A }));

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const evt = mockPublish.mock.calls[0][0];

    expect(evt.kind).toBe(30000);
    const pTags = evt.tags.filter((t: string[]) => t[0] === 'p');
    expect(pTags).toHaveLength(1);
    expect(pTags).toContainEqual(['p', MEMBER_B]);
    expect(pTags).not.toContainEqual(['p', MEMBER_A]);
  });

  it('is idempotent — does not publish when member not in list', async () => {
    mockQuery.mockResolvedValue([makeListEvent([MEMBER_B])]);
    mockPublish.mockResolvedValue(undefined);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useRemoveFromPeopleList(), { wrapper: Wrapper });

    await act(() => result.current.mutateAsync({ listId: LIST_ID, memberPubkey: MEMBER_A }));

    expect(mockPublish).not.toHaveBeenCalled();
  });
});
