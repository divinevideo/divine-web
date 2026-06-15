// ABOUTME: Tests for useCreatePeopleList — kind 30000 publish + cache update
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreatePeopleList } from './useCreatePeopleList';
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

// Stable UUID so tag assertions are predictable
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid-1234'),
});

// --- test wrapper ---
function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { qc, Wrapper };
}

const MEMBER_A = 'b'.repeat(64);
const MEMBER_B = 'c'.repeat(64);

describe('useCreatePeopleList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { pubkey: USER_PK };
  });

  it('throws when there is no current user', async () => {
    mockUser = null;
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreatePeopleList(), { wrapper: Wrapper });

    await expect(
      act(() => result.current.mutateAsync({ name: 'My List' })),
    ).rejects.toThrow('Must be logged in to create lists');

    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('publishes kind 30000 with correct tags including title, description, image and p tags', async () => {
    mockPublish.mockResolvedValue(undefined);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreatePeopleList(), { wrapper: Wrapper });

    await act(() =>
      result.current.mutateAsync({
        name: 'My Friends',
        description: 'Close crew',
        image: 'https://example.com/img.png',
        members: [MEMBER_A, MEMBER_B, MEMBER_A], // intentional duplicate
      }),
    );

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const evt = mockPublish.mock.calls[0][0];

    expect(evt.kind).toBe(30000);
    expect(evt.content).toBe('');
    expect(evt.tags).toContainEqual(['d', 'test-uuid-1234']);
    expect(evt.tags).toContainEqual(['title', 'My Friends']);
    expect(evt.tags).toContainEqual(['description', 'Close crew']);
    expect(evt.tags).toContainEqual(['image', 'https://example.com/img.png']);
    expect(evt.tags).toContainEqual(['p', MEMBER_A]);
    expect(evt.tags).toContainEqual(['p', MEMBER_B]);

    // duplicate MEMBER_A must be deduped — only one ['p', MEMBER_A]
    const pTags = evt.tags.filter((t: string[]) => t[0] === 'p');
    expect(pTags).toHaveLength(2);
  });

  it('omits optional tags when description and image are absent', async () => {
    mockPublish.mockResolvedValue(undefined);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreatePeopleList(), { wrapper: Wrapper });

    await act(() => result.current.mutateAsync({ name: 'Minimal List' }));

    const evt = mockPublish.mock.calls[0][0];
    const tagNames = evt.tags.map((t: string[]) => t[0]);
    expect(tagNames).not.toContain('description');
    expect(tagNames).not.toContain('image');
    expect(tagNames).not.toContain('p');
  });

  it('onSuccess prepends new list to query cache', async () => {
    mockPublish.mockResolvedValue(undefined);
    const { qc, Wrapper } = makeWrapper();

    const existing: PeopleList = {
      id: 'old-list',
      pubkey: USER_PK,
      name: 'Old List',
      members: [],
      createdAt: 1_000_000,
    };
    qc.setQueryData<PeopleList[]>(['people-lists', USER_PK], [existing]);

    const { result } = renderHook(() => useCreatePeopleList(), { wrapper: Wrapper });

    await act(() =>
      result.current.mutateAsync({ name: 'New List', members: [MEMBER_A] }),
    );

    await waitFor(() => {
      const cached = qc.getQueryData<PeopleList[]>(['people-lists', USER_PK]);
      expect(cached).toBeDefined();
      expect(cached![0].name).toBe('New List');
      expect(cached![0].id).toBe('test-uuid-1234');
      expect(cached![1].id).toBe('old-list');
    });
  });
});
