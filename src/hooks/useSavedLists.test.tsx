// ABOUTME: Tests for useSavedLists — parses a tags from kind 30003 'saved-lists' event
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSavedLists } from './useSavedLists';

// --- mocks ---
const mockQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: { query: mockQuery } }),
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

const VALID_PUBKEY = 'b'.repeat(64);

describe('useSavedLists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { pubkey: USER_PK };
  });

  it('returns [] when relay returns no events', async () => {
    mockQuery.mockResolvedValue([]);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSavedLists(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('returns parsed valid refs (mix of 30000 and 30005)', async () => {
    const event = {
      id: 'event-id-1',
      pubkey: USER_PK,
      created_at: 1700000000,
      kind: 30003,
      tags: [
        ['d', 'saved-lists'],
        ['a', `30000:${VALID_PUBKEY}:my-people-list`],
        ['a', `30005:${VALID_PUBKEY}:my-playlist`],
      ],
      content: '',
      sig: 'sig',
    };
    mockQuery.mockResolvedValue([event]);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSavedLists(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { kind: 30000, pubkey: VALID_PUBKEY, dTag: 'my-people-list' },
      { kind: 30005, pubkey: VALID_PUBKEY, dTag: 'my-playlist' },
    ]);
  });

  it('drops a tags with non-list kinds (e.g. 30001)', async () => {
    const event = {
      id: 'event-id-2',
      pubkey: USER_PK,
      created_at: 1700000000,
      kind: 30003,
      tags: [
        ['d', 'saved-lists'],
        ['a', `30000:${VALID_PUBKEY}:good-list`],
        ['a', `30001:${VALID_PUBKEY}:bad-kind`],
        ['a', `34236:${VALID_PUBKEY}:also-bad`],
      ],
      content: '',
      sig: 'sig',
    };
    mockQuery.mockResolvedValue([event]);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSavedLists(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { kind: 30000, pubkey: VALID_PUBKEY, dTag: 'good-list' },
    ]);
  });

  it('drops malformed a values (non-hex pubkey, missing colons)', async () => {
    const event = {
      id: 'event-id-3',
      pubkey: USER_PK,
      created_at: 1700000000,
      kind: 30003,
      tags: [
        ['d', 'saved-lists'],
        ['a', `30000:${VALID_PUBKEY}:valid-list`],
        ['a', '30000:not-a-hex-pubkey:bad-ref'],
        ['a', 'missing-colons'],
        ['a', '30000::no-pubkey'],
        ['a', `30000:${'g'.repeat(64)}:invalid-hex-char`],
      ],
      content: '',
      sig: 'sig',
    };
    mockQuery.mockResolvedValue([event]);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSavedLists(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { kind: 30000, pubkey: VALID_PUBKEY, dTag: 'valid-list' },
    ]);
  });
});
