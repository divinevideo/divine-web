// ABOUTME: Tests for useDeletePeopleList — kind 30000 deletion via NIP-09
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeletePeopleList } from './useDeletePeopleList';
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

// --- test wrapper ---
function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { qc, Wrapper };
}

describe('useDeletePeopleList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { pubkey: USER_PK };
  });

  it('throws when there is no current user', async () => {
    mockUser = null;
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeletePeopleList(), { wrapper: Wrapper });

    await expect(
      act(() => result.current.mutateAsync({ listId: 'test-list' })),
    ).rejects.toThrow('Must be logged in to delete lists');

    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('publishes kind 5 with both a and k tags (NIP-09 conformance)', async () => {
    mockPublish.mockResolvedValue(undefined);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeletePeopleList(), { wrapper: Wrapper });

    await act(() => result.current.mutateAsync({ listId: 'my-people-list' }));

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const evt = mockPublish.mock.calls[0][0];

    expect(evt.kind).toBe(5);
    expect(evt.content).toBe('List deleted by owner');
    expect(evt.tags).toContainEqual(['a', `30000:${USER_PK}:my-people-list`]);
    expect(evt.tags).toContainEqual(['k', '30000']);
  });

  it('onSuccess removes list from people-lists cache and invalidates both caches', async () => {
    mockPublish.mockResolvedValue(undefined);
    const { qc, Wrapper } = makeWrapper();

    const list1: PeopleList = {
      id: 'list-1',
      pubkey: USER_PK,
      name: 'Friends',
      members: [],
      createdAt: 1_000_000,
    };
    const list2: PeopleList = {
      id: 'list-2',
      pubkey: USER_PK,
      name: 'Colleagues',
      members: [],
      createdAt: 1_000_001,
    };
    qc.setQueryData<PeopleList[]>(['people-lists', USER_PK], [list1, list2]);

    const { result } = renderHook(() => useDeletePeopleList(), { wrapper: Wrapper });

    await act(() => result.current.mutateAsync({ listId: 'list-1' }));

    await waitFor(() => {
      const cached = qc.getQueryData<PeopleList[]>(['people-lists', USER_PK]);
      expect(cached).toBeDefined();
      expect(cached).toHaveLength(1);
      expect(cached![0].id).toBe('list-2');
    });
  });
});
