// ABOUTME: Tests for profile badge hook relay timeout behavior
// ABOUTME: Ensures badge lookups settle on abort instead of hiding profile surfaces behind errors

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

import { BADGE_KINDS } from '@/lib/badges';

import { useBadges } from './useBadges';

const mockNostrQuery = vi.fn();

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

const TEST_PUBKEY = 'a'.repeat(64);
const ISSUER_PUBKEY = 'b'.repeat(64);

function makeEvent(opts: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'f'.repeat(64),
    pubkey: TEST_PUBKEY,
    created_at: 1_700_000_000,
    kind: 1,
    tags: [],
    content: '',
    sig: '0'.repeat(128),
    ...opts,
  };
}

function makeDefinition(dTag: string): NostrEvent {
  return makeEvent({
    id: `${dTag.length}`.repeat(64).slice(0, 64),
    pubkey: ISSUER_PUBKEY,
    kind: BADGE_KINDS.DEFINITION,
    tags: [
      ['d', dTag],
      ['name', `Badge ${dTag}`],
      ['description', `Description ${dTag}`],
      ['image', `https://example.com/${dTag}.png`],
    ],
  });
}

function makeAward(dTag: string, id = `${dTag.length + 1}`.repeat(64).slice(0, 64)): NostrEvent {
  return makeEvent({
    id,
    pubkey: ISSUER_PUBKEY,
    kind: BADGE_KINDS.AWARD,
    tags: [
      ['a', `30009:${ISSUER_PUBKEY}:${dTag}`],
      ['p', TEST_PUBKEY],
    ],
  });
}

function makeProfileBadges(kind: number, dTag: string, awardId: string, createdAt = 1_700_000_000): NostrEvent {
  return makeEvent({
    id: `${kind}`.repeat(64).slice(0, 64),
    pubkey: TEST_PUBKEY,
    kind,
    created_at: createdAt,
    tags: [
      ...(kind === 30008 ? [['d', 'profile_badges']] : []),
      ['a', `30009:${ISSUER_PUBKEY}:${dTag}`],
      ['e', awardId],
    ],
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useBadges', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches and validates badges from kind 10008 profile badges', async () => {
    const award = makeAward('current', '1'.repeat(64));
    const definition = makeDefinition('current');
    const profileBadges = makeProfileBadges(10008, 'current', award.id);

    mockNostrQuery
      .mockResolvedValueOnce([profileBadges])
      .mockResolvedValueOnce([definition])
      .mockResolvedValueOnce([award]);

    const { result } = renderHook(
      () => useBadges(TEST_PUBKEY),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].definition.dTag).toBe('current');
    const profileFilters = mockNostrQuery.mock.calls[0][0] as NostrFilter[];
    expect(profileFilters).toEqual([
      { kinds: [10008], authors: [TEST_PUBKEY], limit: 10 },
      {
        kinds: [30008],
        authors: [TEST_PUBKEY],
        '#d': ['profile_badges'],
        limit: 10,
      },
    ]);
  });

  it('keeps legacy kind 30008 profile_badges rendering', async () => {
    const award = makeAward('legacy', '2'.repeat(64));
    const definition = makeDefinition('legacy');
    const profileBadges = makeProfileBadges(30008, 'legacy', award.id);

    mockNostrQuery
      .mockResolvedValueOnce([profileBadges])
      .mockResolvedValueOnce([definition])
      .mockResolvedValueOnce([award]);

    const { result } = renderHook(
      () => useBadges(TEST_PUBKEY),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].definition.dTag).toBe('legacy');
  });

  it('uses a newer legacy profile badges event over an older kind 10008 event', async () => {
    const award = makeAward('newer-legacy', '3'.repeat(64));
    const definition = makeDefinition('newer-legacy');
    const current = makeProfileBadges(10008, 'current-old', '4'.repeat(64), 10);
    const legacy = makeProfileBadges(30008, 'newer-legacy', award.id, 20);

    mockNostrQuery
      .mockResolvedValueOnce([current, legacy])
      .mockResolvedValueOnce([definition])
      .mockResolvedValueOnce([award]);

    const { result } = renderHook(
      () => useBadges(TEST_PUBKEY),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].definition.dTag).toBe('newer-legacy');
  });

  it('falls back to awards only when no profile badges event exists', async () => {
    const award = makeAward('fallback', '5'.repeat(64));
    const definition = makeDefinition('fallback');

    mockNostrQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([award])
      .mockResolvedValueOnce([definition]);

    const { result } = renderHook(
      () => useBadges(TEST_PUBKEY),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].definition.dTag).toBe('fallback');
  });

  it('returns an empty list without awards fallback when profile badges has no refs', async () => {
    mockNostrQuery.mockResolvedValueOnce([
      makeEvent({
        id: '6'.repeat(64),
        pubkey: TEST_PUBKEY,
        kind: 10008,
        tags: [],
      }),
    ]);

    const { result } = renderHook(
      () => useBadges(TEST_PUBKEY),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(mockNostrQuery).toHaveBeenCalledTimes(1);
  });

  it('settles with an empty list when the timed-out relay query throws on abort', async () => {
    vi.useFakeTimers();

    mockNostrQuery.mockImplementation(
      (_filters: unknown, opts: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );

    const { result } = renderHook(
      () => useBadges(TEST_PUBKEY),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    vi.useRealTimers();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(result.current.isError).toBe(false);
  });
});
