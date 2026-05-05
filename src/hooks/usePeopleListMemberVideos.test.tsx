// ABOUTME: Tests for usePeopleListMemberVideos — relay-only aggregated feed
// ABOUTME: Verifies enabled gating, single-page result sorting, and multi-page pagination

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePeopleListMemberVideos } from './usePeopleListMemberVideos';
import type { NostrEvent } from '@nostrify/nostrify';

// ---- module mocks -----------------------------------------------------------

vi.mock('./usePeopleList');
vi.mock('@nostrify/react');

import { usePeopleList } from './usePeopleList';
import { useNostr } from '@nostrify/react';

const mockUsePeopleList = vi.mocked(usePeopleList);
const mockNostrQuery = vi.fn();

// ---- helpers ----------------------------------------------------------------

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const PK = 'a'.repeat(64);
const MEMBER_A = 'b'.repeat(64);
const MEMBER_B = 'c'.repeat(64);
const D_TAG = 'my-list';

function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'evt-' + Math.random().toString(36).slice(2),
    kind: 34236,
    pubkey: MEMBER_A,
    created_at: 1_000_000,
    tags: [['d', 'vid-1']],
    content: '',
    sig: 'sig',
    ...overrides,
  };
}

function makeListSuccess(members: string[]) {
  return {
    isSuccess: true,
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

function makeListLoading() {
  return {
    isSuccess: false,
    isLoading: true,
    isError: false,
    data: undefined,
  };
}

// ---- tests ------------------------------------------------------------------

describe('usePeopleListMemberVideos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNostr).mockReturnValue({ nostr: { query: mockNostrQuery } } as any);
  });

  // Test 1: empty members → query is disabled, nostr.query never called
  it('does not fire nostr.query when members list is empty', () => {
    mockUsePeopleList.mockReturnValue(makeListSuccess([]) as any);

    const { result } = renderHook(
      () => usePeopleListMemberVideos(PK, D_TAG),
      { wrapper: wrap },
    );

    // Query should remain idle (not fetching)
    expect(result.current.isFetching).toBe(false);
    expect(result.current.status).toBe('pending');
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });

  // Test 2: single page, sorted desc, next-page returns undefined when < PAGE_SIZE
  it('returns single page sorted by created_at desc, no next page when fewer than PAGE_SIZE events', async () => {
    mockUsePeopleList.mockReturnValue(makeListSuccess([MEMBER_A, MEMBER_B]) as any);

    const older = makeEvent({ created_at: 900_000, pubkey: MEMBER_A });
    const newer = makeEvent({ created_at: 1_100_000, pubkey: MEMBER_B });
    // Return fewer than PAGE_SIZE (50) events
    mockNostrQuery.mockResolvedValueOnce([older, newer]);

    const { result } = renderHook(
      () => usePeopleListMemberVideos(PK, D_TAG),
      { wrapper: wrap },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const page0 = result.current.data!.pages[0];
    expect(page0).toHaveLength(2);
    // Sorted newest-first
    expect(page0[0].created_at).toBe(1_100_000);
    expect(page0[1].created_at).toBe(900_000);

    // No next page available (< PAGE_SIZE events returned)
    expect(result.current.hasNextPage).toBe(false);
  });

  // Test 3: two pages happy path — first page full (50 events), second partial (10 events)
  it('paginates correctly: first page of 50 + second page of 10 = 60 total events', async () => {
    mockUsePeopleList.mockReturnValue(makeListSuccess([MEMBER_A]) as any);

    const PAGE_SIZE = 50;

    // Build 50 events for page 1 with descending timestamps
    const page1Events: NostrEvent[] = Array.from({ length: PAGE_SIZE }, (_, i) =>
      makeEvent({ created_at: 1_000_000 - i * 1000, pubkey: MEMBER_A }),
    );
    // Build 10 events for page 2 with lower timestamps
    const page2Events: NostrEvent[] = Array.from({ length: 10 }, (_, i) =>
      makeEvent({ created_at: 900_000 - i * 1000, pubkey: MEMBER_A }),
    );

    // Return 50 first, then 10 on the second call
    mockNostrQuery
      .mockResolvedValueOnce(page1Events)
      .mockResolvedValueOnce(page2Events);

    const { result } = renderHook(
      () => usePeopleListMemberVideos(PK, D_TAG),
      { wrapper: wrap },
    );

    // First page loads
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.pages[0]).toHaveLength(PAGE_SIZE);
    expect(result.current.hasNextPage).toBe(true);

    // Fetch next page
    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data!.pages).toHaveLength(2));

    const allEvents = result.current.data!.pages.flat();
    expect(allEvents).toHaveLength(60);

    // After second page (10 < PAGE_SIZE), no more pages
    expect(result.current.hasNextPage).toBe(false);
  });

  // Test 4: list still loading → query is disabled
  it('is disabled while usePeopleList is still loading', () => {
    mockUsePeopleList.mockReturnValue(makeListLoading() as any);

    const { result } = renderHook(
      () => usePeopleListMemberVideos(PK, D_TAG),
      { wrapper: wrap },
    );

    expect(result.current.isFetching).toBe(false);
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });
});
