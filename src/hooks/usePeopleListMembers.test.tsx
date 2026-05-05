// src/hooks/usePeopleListMembers.test.tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePeopleListMembers } from './usePeopleListMembers';

// ---- mock both composed hooks ------------------------------------------------

vi.mock('./usePeopleList');
vi.mock('./useBatchedAuthors');

import { usePeopleList } from './usePeopleList';
import { useBatchedAuthors } from './useBatchedAuthors';

const mockUsePeopleList = vi.mocked(usePeopleList);
const mockUseBatchedAuthors = vi.mocked(useBatchedAuthors);

// ---- helpers -----------------------------------------------------------------

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const PK = 'a'.repeat(64);
const MEMBER_A = 'b'.repeat(64);
const MEMBER_B = 'c'.repeat(64);
const D_TAG = 'my-list';

function makeList(members: string[]) {
  return {
    isLoading: false,
    isError: false,
    data: {
      id: D_TAG,
      pubkey: PK,
      name: 'My List',
      members,
      createdAt: 1000,
    },
  };
}

function makeAuthors(entries: Record<string, { name?: string }>) {
  const data: Record<string, { metadata: { name?: string } }> = {};
  for (const [pk, meta] of Object.entries(entries)) {
    data[pk] = { metadata: meta };
  }
  return { isLoading: false, isError: false, data };
}

// ---- tests -------------------------------------------------------------------

describe('usePeopleListMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 2 entries with metadata populated when list has 2 members', async () => {
    mockUsePeopleList.mockReturnValue(makeList([MEMBER_A, MEMBER_B]) as ReturnType<typeof usePeopleList>);
    mockUseBatchedAuthors.mockReturnValue(
      makeAuthors({ [MEMBER_A]: { name: 'Alice' }, [MEMBER_B]: { name: 'Bob' } }) as ReturnType<typeof useBatchedAuthors>,
    );

    const { result } = renderHook(() => usePeopleListMembers(PK, D_TAG), { wrapper: wrap });

    await waitFor(() => {
      expect(result.current.members).toHaveLength(2);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);

    const alice = result.current.members.find(m => m.pubkey === MEMBER_A);
    const bob = result.current.members.find(m => m.pubkey === MEMBER_B);
    expect(alice?.metadata?.name).toBe('Alice');
    expect(bob?.metadata?.name).toBe('Bob');
  });

  it('returns empty members array when list has 0 members', async () => {
    mockUsePeopleList.mockReturnValue(makeList([]) as ReturnType<typeof usePeopleList>);
    mockUseBatchedAuthors.mockReturnValue(makeAuthors({}) as ReturnType<typeof useBatchedAuthors>);

    const { result } = renderHook(() => usePeopleListMembers(PK, D_TAG), { wrapper: wrap });

    await waitFor(() => {
      expect(result.current.members).toHaveLength(0);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('isLoading is true when usePeopleList is loading', () => {
    mockUsePeopleList.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    } as unknown as ReturnType<typeof usePeopleList>);
    mockUseBatchedAuthors.mockReturnValue(makeAuthors({}) as ReturnType<typeof useBatchedAuthors>);

    const { result } = renderHook(() => usePeopleListMembers(PK, D_TAG), { wrapper: wrap });

    expect(result.current.isLoading).toBe(true);
  });

  it('isLoading is true when useBatchedAuthors is loading', () => {
    mockUsePeopleList.mockReturnValue(makeList([MEMBER_A]) as ReturnType<typeof usePeopleList>);
    mockUseBatchedAuthors.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    } as unknown as ReturnType<typeof useBatchedAuthors>);

    const { result } = renderHook(() => usePeopleListMembers(PK, D_TAG), { wrapper: wrap });

    expect(result.current.isLoading).toBe(true);
  });

  it('isError is true when usePeopleList errors', () => {
    mockUsePeopleList.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
    } as unknown as ReturnType<typeof usePeopleList>);
    mockUseBatchedAuthors.mockReturnValue(makeAuthors({}) as ReturnType<typeof useBatchedAuthors>);

    const { result } = renderHook(() => usePeopleListMembers(PK, D_TAG), { wrapper: wrap });

    expect(result.current.isError).toBe(true);
  });

  it('returns metadata as undefined for members missing from authors response', async () => {
    mockUsePeopleList.mockReturnValue(makeList([MEMBER_A]) as ReturnType<typeof usePeopleList>);
    // authors returns empty — MEMBER_A not resolved
    mockUseBatchedAuthors.mockReturnValue(makeAuthors({}) as ReturnType<typeof useBatchedAuthors>);

    const { result } = renderHook(() => usePeopleListMembers(PK, D_TAG), { wrapper: wrap });

    await waitFor(() => {
      expect(result.current.members).toHaveLength(1);
    });

    expect(result.current.members[0].pubkey).toBe(MEMBER_A);
    expect(result.current.members[0].metadata).toBeUndefined();
  });
});
