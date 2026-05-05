// ABOUTME: Tests for useResolvedSavedLists — resolves saved-list refs to live list events, dropping stale/dead refs
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useResolvedSavedLists } from './useResolvedSavedLists';
import type { SavedListRef } from './useSavedLists';

// --- mocks ---

// Mock useSavedLists to return controlled refs
let mockSavedRefs: SavedListRef[] = [];
let mockSavedLoading = false;
let mockSavedError = false;

vi.mock('./useSavedLists', () => ({
  useSavedLists: () => ({
    data: mockSavedRefs,
    isLoading: mockSavedLoading,
    isError: mockSavedError,
  }),
}));

// Mock useNostr — relay query is the main behavior under test
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

const PUBKEY_A = 'a'.repeat(64);
const PUBKEY_B = 'b'.repeat(64);

// Minimal valid kind-30000 event
const PEOPLE_EVENT = {
  id: 'people-event-id',
  pubkey: PUBKEY_A,
  created_at: 1700000000,
  kind: 30000,
  tags: [['d', 'my-people-list'], ['title', 'My People']],
  content: '',
  sig: 'sig',
};

// Minimal valid kind-30005 event
const VIDEO_EVENT = {
  id: 'video-event-id',
  pubkey: PUBKEY_B,
  created_at: 1700000001,
  kind: 30005,
  tags: [['d', 'my-playlist'], ['title', 'My Playlist']],
  content: '',
  sig: 'sig',
};

// kind-5 deletion event (wrong kind for a list ref — should be dropped)
const DELETION_EVENT = {
  id: 'deletion-event-id',
  pubkey: PUBKEY_A,
  created_at: 1700000002,
  kind: 5,
  tags: [['a', `30000:${PUBKEY_A}:my-people-list`]],
  content: 'deleted',
  sig: 'sig',
};

// --- tests ---

describe('useResolvedSavedLists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSavedRefs = [];
    mockSavedLoading = false;
    mockSavedError = false;
  });

  it('returns 1 people + 1 video when both refs resolve successfully', async () => {
    mockSavedRefs = [
      { kind: 30000, pubkey: PUBKEY_A, dTag: 'my-people-list' },
      { kind: 30005, pubkey: PUBKEY_B, dTag: 'my-playlist' },
    ];

    // First call returns the people list event, second returns the video list event
    mockQuery
      .mockResolvedValueOnce([PEOPLE_EVENT])
      .mockResolvedValueOnce([VIDEO_EVENT]);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useResolvedSavedLists(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.people).toHaveLength(1);
    expect(result.current.people[0].id).toBe('my-people-list');

    expect(result.current.video).toHaveLength(1);
    expect(result.current.video[0].id).toBe('my-playlist');

    expect(result.current.isError).toBe(false);
  });

  it('drops a ref when the relay returns 0 events (stale reference)', async () => {
    mockSavedRefs = [
      { kind: 30000, pubkey: PUBKEY_A, dTag: 'gone-list' },
    ];

    // Relay returns nothing — the list no longer exists
    mockQuery.mockResolvedValueOnce([]);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useResolvedSavedLists(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.people).toHaveLength(0);
    expect(result.current.video).toHaveLength(0);
  });

  it('drops a ref when relay returns an event of unexpected kind (e.g. kind 5 deletion)', async () => {
    mockSavedRefs = [
      // ref claims kind 30000, but relay returns a kind-5 deletion event
      { kind: 30000, pubkey: PUBKEY_A, dTag: 'my-people-list' },
    ];

    mockQuery.mockResolvedValueOnce([DELETION_EVENT]);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useResolvedSavedLists(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Kind mismatch — the result should be null, so both arrays should be empty
    expect(result.current.people).toHaveLength(0);
    expect(result.current.video).toHaveLength(0);
  });
});
