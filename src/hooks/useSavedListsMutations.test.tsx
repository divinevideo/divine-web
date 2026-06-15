// ABOUTME: Tests for useSaveList and useUnsaveList (kind 30003 saved-lists mutations)
// ABOUTME: Verifies optimistic updates, idempotency, rollback on error

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSaveList, useUnsaveList } from './useSavedListsMutations';
import type { SavedListRef } from './useSavedLists';

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
const VALID_PUBKEY_B = 'b'.repeat(64);
const VALID_PUBKEY_C = 'c'.repeat(64);

// --- helpers ---
function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { qc, Wrapper };
}

function makeSavedListsEvent(aTags: string[] = []) {
  return {
    id: 'event-id-1',
    pubkey: USER_PK,
    kind: 30003,
    created_at: 1_700_000_000,
    content: '',
    sig: 'sig',
    tags: [
      ['d', 'saved-lists'],
      ...aTags.map((val) => ['a', val]),
    ],
  };
}

function seedCache(qc: QueryClient, refs: SavedListRef[]) {
  qc.setQueryData(['saved-lists', USER_PK], refs);
}

// --- tests ---

describe('useSaveList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { pubkey: USER_PK };
  });

  it('fresh empty state (no prior event) publishes a new event with one a tag', async () => {
    // No prior event on relay
    mockQuery.mockResolvedValue([]);
    mockPublish.mockResolvedValue(undefined);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSaveList(), { wrapper: Wrapper });

    await act(() =>
      result.current.mutateAsync({ kind: 30000, pubkey: VALID_PUBKEY_B, dTag: 'my-list' }),
    );

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const evt = mockPublish.mock.calls[0][0];
    expect(evt.kind).toBe(30003);
    expect(evt.content).toBe('');

    const dTag = evt.tags.find((t: string[]) => t[0] === 'd');
    expect(dTag).toEqual(['d', 'saved-lists']);

    const aTags = evt.tags.filter((t: string[]) => t[0] === 'a');
    expect(aTags).toHaveLength(1);
    expect(aTags[0]).toEqual(['a', `30000:${VALID_PUBKEY_B}:my-list`]);
  });

  it('existing event with 1 ref, adding a different ref publishes with 2 a tags', async () => {
    const existingRef = `30005:${VALID_PUBKEY_C}:my-playlist`;
    mockQuery.mockResolvedValue([makeSavedListsEvent([existingRef])]);
    mockPublish.mockResolvedValue(undefined);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSaveList(), { wrapper: Wrapper });

    await act(() =>
      result.current.mutateAsync({ kind: 30000, pubkey: VALID_PUBKEY_B, dTag: 'my-list' }),
    );

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const evt = mockPublish.mock.calls[0][0];
    const aTags = evt.tags.filter((t: string[]) => t[0] === 'a');
    expect(aTags).toHaveLength(2);
    expect(aTags).toContainEqual(['a', existingRef]);
    expect(aTags).toContainEqual(['a', `30000:${VALID_PUBKEY_B}:my-list`]);
    // new tag appended last
    expect(aTags[aTags.length - 1]).toEqual(['a', `30000:${VALID_PUBKEY_B}:my-list`]);
  });

  it('already saved is idempotent (no publish call)', async () => {
    const existingRef = `30000:${VALID_PUBKEY_B}:my-list`;
    mockQuery.mockResolvedValue([makeSavedListsEvent([existingRef])]);
    mockPublish.mockResolvedValue(undefined);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSaveList(), { wrapper: Wrapper });

    await act(() =>
      result.current.mutateAsync({ kind: 30000, pubkey: VALID_PUBKEY_B, dTag: 'my-list' }),
    );

    expect(mockPublish).not.toHaveBeenCalled();
  });
});

describe('useUnsaveList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { pubkey: USER_PK };
  });

  it('removes matching a tag and publishes without it', async () => {
    const refToRemove = `30000:${VALID_PUBKEY_B}:my-list`;
    const refToKeep = `30005:${VALID_PUBKEY_C}:my-playlist`;
    mockQuery.mockResolvedValue([makeSavedListsEvent([refToRemove, refToKeep])]);
    mockPublish.mockResolvedValue(undefined);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUnsaveList(), { wrapper: Wrapper });

    await act(() =>
      result.current.mutateAsync({ kind: 30000, pubkey: VALID_PUBKEY_B, dTag: 'my-list' }),
    );

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const evt = mockPublish.mock.calls[0][0];
    const aTags = evt.tags.filter((t: string[]) => t[0] === 'a');
    expect(aTags).toHaveLength(1);
    expect(aTags).toContainEqual(['a', refToKeep]);
    expect(aTags).not.toContainEqual(['a', refToRemove]);
  });
});

describe('optimistic rollback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { pubkey: USER_PK };
  });

  it("rolls back ['saved-lists', pubkey] cache when publish fails", async () => {
    mockQuery.mockResolvedValue([]);
    mockPublish.mockRejectedValue(new Error('relay down'));

    const { qc, Wrapper } = makeWrapper();
    const initialRefs: SavedListRef[] = [{ kind: 30000, pubkey: VALID_PUBKEY_C, dTag: 'existing' }];
    seedCache(qc, initialRefs);

    const { result } = renderHook(() => useSaveList(), { wrapper: Wrapper });

    await expect(
      act(() =>
        result.current.mutateAsync({ kind: 30000, pubkey: VALID_PUBKEY_B, dTag: 'new-list' }),
      ),
    ).rejects.toThrow('relay down');

    // Cache must be rolled back to pre-mutation state
    const cached = qc.getQueryData<SavedListRef[]>(['saved-lists', USER_PK]);
    expect(cached).toEqual(initialRefs);
    expect(cached?.some((r) => r.dTag === 'new-list')).toBe(false);
  });
});
