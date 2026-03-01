// ABOUTME: Tests for usePinnedVideos hooks
// ABOUTME: Verifies pin list parsing, pin/unpin mutations, and validation logic

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { NostrEvent } from '@nostrify/nostrify';

// Mock nostr provider
const mockQuery = vi.fn();
const mockNostr = { query: mockQuery };

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: mockNostr }),
}));

// Mock current user
const mockUser = { pubkey: 'abc123', signer: { signEvent: vi.fn() } };
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: mockUser }),
}));

// Mock publish
const mockPublishEvent = vi.fn().mockResolvedValue({});
vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: mockPublishEvent,
    mutate: mockPublishEvent,
  }),
}));

import { usePinnedVideos, usePinVideo, useUnpinVideo, useIsVideoPinned, PIN_LIST_KIND, MAX_PINNED_VIDEOS } from './usePinnedVideos';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function makePinListEvent(tags: string[][], pubkey = 'abc123'): NostrEvent {
  return {
    id: 'event-1',
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: PIN_LIST_KIND,
    tags,
    content: '',
    sig: 'sig-placeholder',
  };
}

describe('usePinnedVideos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no pin list exists', async () => {
    mockQuery.mockResolvedValue([]);

    const { result } = renderHook(() => usePinnedVideos('abc123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('parses a tags from kind 10001 event correctly', async () => {
    const event = makePinListEvent([
      ['a', '34236:pubkey1:video-1'],
      ['a', '34236:pubkey2:video-2'],
    ]);
    mockQuery.mockResolvedValue([event]);

    const { result } = renderHook(() => usePinnedVideos('abc123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      '34236:pubkey1:video-1',
      '34236:pubkey2:video-2',
    ]);
  });

  it('ignores non-video tags (e tags for note pins)', async () => {
    const event = makePinListEvent([
      ['e', 'note-event-id-1'],
      ['a', '34236:pubkey1:video-1'],
      ['a', '1:pubkey1:article-1'], // non-video kind
      ['e', 'note-event-id-2'],
    ]);
    mockQuery.mockResolvedValue([event]);

    const { result } = renderHook(() => usePinnedVideos('abc123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(['34236:pubkey1:video-1']);
  });
});

describe('usePinVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds coordinate and publishes kind 10001', async () => {
    // No existing pin list
    mockQuery.mockResolvedValue([]);

    const { result } = renderHook(() => usePinVideo(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ coordinate: '34236:pubkey1:video-1' });
    });

    expect(mockPublishEvent).toHaveBeenCalledWith({
      kind: PIN_LIST_KIND,
      content: '',
      tags: [['a', '34236:pubkey1:video-1']],
    });
  });

  it('preserves existing tags when adding new pin', async () => {
    const existingEvent = makePinListEvent([
      ['a', '34236:pubkey1:video-1'],
      ['e', 'some-note-id'], // non-video tag from another app
    ]);
    mockQuery.mockResolvedValue([existingEvent]);

    const { result } = renderHook(() => usePinVideo(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ coordinate: '34236:pubkey2:video-2' });
    });

    expect(mockPublishEvent).toHaveBeenCalledWith({
      kind: PIN_LIST_KIND,
      content: '',
      tags: [
        ['a', '34236:pubkey1:video-1'],
        ['e', 'some-note-id'],
        ['a', '34236:pubkey2:video-2'],
      ],
    });
  });

  it('rejects at MAX_PINNED_VIDEOS limit', async () => {
    const existingEvent = makePinListEvent([
      ['a', '34236:pubkey1:video-1'],
      ['a', '34236:pubkey1:video-2'],
      ['a', '34236:pubkey1:video-3'],
    ]);
    mockQuery.mockResolvedValue([existingEvent]);

    const { result } = renderHook(() => usePinVideo(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ coordinate: '34236:pubkey1:video-4' });
      })
    ).rejects.toThrow(`You can pin up to ${MAX_PINNED_VIDEOS} videos`);

    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('deduplicates (will not pin same video twice)', async () => {
    const existingEvent = makePinListEvent([
      ['a', '34236:pubkey1:video-1'],
    ]);
    mockQuery.mockResolvedValue([existingEvent]);

    const { result } = renderHook(() => usePinVideo(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ coordinate: '34236:pubkey1:video-1' });
    });

    // Should not publish since it's already pinned
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});

describe('useUnpinVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes coordinate and republishes', async () => {
    const existingEvent = makePinListEvent([
      ['a', '34236:pubkey1:video-1'],
      ['a', '34236:pubkey2:video-2'],
      ['e', 'some-note-id'],
    ]);
    mockQuery.mockResolvedValue([existingEvent]);

    const { result } = renderHook(() => useUnpinVideo(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ coordinate: '34236:pubkey1:video-1' });
    });

    expect(mockPublishEvent).toHaveBeenCalledWith({
      kind: PIN_LIST_KIND,
      content: '',
      tags: [
        ['a', '34236:pubkey2:video-2'],
        ['e', 'some-note-id'],
      ],
    });
  });

  it('does nothing when no pin list exists', async () => {
    mockQuery.mockResolvedValue([]);

    const { result } = renderHook(() => useUnpinVideo(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ coordinate: '34236:pubkey1:video-1' });
    });

    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});

describe('useIsVideoPinned', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when coordinate is pinned', async () => {
    const event = makePinListEvent([
      ['a', '34236:abc123:video-1'],
    ]);
    mockQuery.mockResolvedValue([event]);

    const { result } = renderHook(() => useIsVideoPinned('34236:abc123:video-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('returns false when coordinate is not pinned', async () => {
    const event = makePinListEvent([
      ['a', '34236:abc123:video-1'],
    ]);
    mockQuery.mockResolvedValue([event]);

    const { result } = renderHook(() => useIsVideoPinned('34236:abc123:video-999'), {
      wrapper: createWrapper(),
    });

    // Need to wait for the query to settle
    await waitFor(() => {
      // The hook should return false after data loads
      expect(result.current).toBe(false);
    });
  });

  it('returns false when no coordinate provided', () => {
    const { result } = renderHook(() => useIsVideoPinned(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(false);
  });
});
