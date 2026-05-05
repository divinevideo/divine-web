// ABOUTME: Tests for useUpdatePeopleList — edit metadata of an existing kind 30000 list
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUpdatePeopleList } from './useUpdatePeopleList';

// --- mocks ---
const mockPublish = vi.fn();
vi.mock('./useNostrPublish', () => ({
  useNostrPublish: () => ({ mutateAsync: mockPublish }),
}));

const USER_PK = 'a'.repeat(64);
const MEMBER_A = 'b'.repeat(64);
const MEMBER_B = 'c'.repeat(64);
let mockUser: { pubkey: string } | null = { pubkey: USER_PK };
vi.mock('./useCurrentUser', () => ({
  useCurrentUser: () => ({ user: mockUser }),
}));

const mockQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: { query: mockQuery } }),
}));

// --- helpers ---
function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { qc, Wrapper };
}

/** Build a minimal kind 30000 NostrEvent compatible with parsePeopleList */
function makeListEvent(overrides?: { tags?: string[][] }) {
  return {
    id: 'event-id-1',
    pubkey: USER_PK,
    kind: 30000,
    created_at: 1_700_000_000,
    content: '',
    sig: 'sig',
    tags: overrides?.tags ?? [
      ['d', 'list-1'],
      ['title', 'Original Name'],
      ['description', 'Original desc'],
      ['image', 'https://example.com/img.png'],
      ['p', MEMBER_A],
      ['p', MEMBER_B],
    ],
  };
}

describe('useUpdatePeopleList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { pubkey: USER_PK };
  });

  it('throws when there is no current user', async () => {
    mockUser = null;
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdatePeopleList(), { wrapper: Wrapper });

    await expect(
      act(() => result.current.mutateAsync({ listId: 'list-1', name: 'New Name' })),
    ).rejects.toThrow('Must be logged in to update lists');

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('throws "List not found" when relay returns 0 events', async () => {
    mockQuery.mockResolvedValue([]);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdatePeopleList(), { wrapper: Wrapper });

    await expect(
      act(() => result.current.mutateAsync({ listId: 'missing-list', name: 'X' })),
    ).rejects.toThrow('List not found');

    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('updates name only — title tag changes, all p tags preserved', async () => {
    mockQuery.mockResolvedValue([makeListEvent()]);
    mockPublish.mockResolvedValue(undefined);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdatePeopleList(), { wrapper: Wrapper });

    await act(() =>
      result.current.mutateAsync({ listId: 'list-1', name: 'New Name' }),
    );

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const evt = mockPublish.mock.calls[0][0];

    expect(evt.kind).toBe(30000);
    expect(evt.content).toBe('');

    // Title updated
    const titleTag = evt.tags.find((t: string[]) => t[0] === 'title');
    expect(titleTag).toEqual(['title', 'New Name']);

    // Existing description preserved (not provided in update)
    const descTag = evt.tags.find((t: string[]) => t[0] === 'description');
    expect(descTag).toEqual(['description', 'Original desc']);

    // Existing image preserved
    const imageTag = evt.tags.find((t: string[]) => t[0] === 'image');
    expect(imageTag).toEqual(['image', 'https://example.com/img.png']);

    // Both p tags preserved
    const pTags = evt.tags.filter((t: string[]) => t[0] === 'p');
    expect(pTags).toHaveLength(2);
    expect(pTags).toContainEqual(['p', MEMBER_A]);
    expect(pTags).toContainEqual(['p', MEMBER_B]);
  });

  it('sets description to empty string — description tag is omitted from new event', async () => {
    mockQuery.mockResolvedValue([makeListEvent()]);
    mockPublish.mockResolvedValue(undefined);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdatePeopleList(), { wrapper: Wrapper });

    await act(() =>
      result.current.mutateAsync({ listId: 'list-1', description: '' }),
    );

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const evt = mockPublish.mock.calls[0][0];

    // Description cleared (empty string → omit tag)
    const descTag = evt.tags.find((t: string[]) => t[0] === 'description');
    expect(descTag).toBeUndefined();

    // Title unchanged (name not provided)
    const titleTag = evt.tags.find((t: string[]) => t[0] === 'title');
    expect(titleTag).toEqual(['title', 'Original Name']);

    // p tags still preserved
    const pTags = evt.tags.filter((t: string[]) => t[0] === 'p');
    expect(pTags).toHaveLength(2);
  });
});
