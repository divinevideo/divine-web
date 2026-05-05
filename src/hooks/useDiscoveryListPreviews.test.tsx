// ABOUTME: Tests for useDiscoveryListPreviews — batch fetching of avatars + first-video thumbnails
// ABOUTME: Verifies author cache warming, video coord parsing, and thumbnail extraction

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDiscoveryListPreviews } from './useDiscoveryListPreviews';
import type { DiscoveryListItem } from './useDiscoveryLists';

// ---- mocks -------------------------------------------------------------------

const mockNostrQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: { query: mockNostrQuery } }),
}));

vi.mock('./useBatchedAuthors', () => ({
  useBatchedAuthors: vi.fn(),
}));

vi.mock('@/lib/funnelcakeHealth', () => ({
  isFunnelcakeAvailable: () => false,
}));

// ---- helpers -----------------------------------------------------------------

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const PUBKEY = 'a'.repeat(64);
const VIDEO_AUTHOR = 'd'.repeat(64);

// ---- tests -------------------------------------------------------------------

describe('useDiscoveryListPreviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns metadata from the React Query author cache for people-list members', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const memberPubkey = 'b'.repeat(64);
    qc.setQueryData(['author', memberPubkey], {
      metadata: { picture: 'https://cdn.example/pic.jpg' },
    });

    const items: DiscoveryListItem[] = [
      {
        kind: 30000,
        list: {
          id: 'cool',
          pubkey: PUBKEY,
          name: 'Cool',
          members: [memberPubkey],
          createdAt: 0,
        },
      },
    ];

    const { result } = renderHook(() => useDiscoveryListPreviews(items), {
      wrapper: makeWrapper(qc),
    });

    expect(result.current.getMemberMetadata(memberPubkey)).toEqual({
      picture: 'https://cdn.example/pic.jpg',
    });
    expect(result.current.getMemberMetadata('z'.repeat(64))).toBeUndefined();
  });

  it('queries first videos for video lists and surfaces extracted thumbnails', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const items: DiscoveryListItem[] = [
      {
        kind: 30005,
        list: {
          id: 'best',
          pubkey: PUBKEY,
          name: 'Best',
          public: true,
          videoCoordinates: [`34236:${VIDEO_AUTHOR}:vid-1`, `34236:${VIDEO_AUTHOR}:vid-2`],
          createdAt: 0,
        },
      },
    ];

    mockNostrQuery.mockResolvedValueOnce([
      {
        id: 'evt',
        pubkey: VIDEO_AUTHOR,
        kind: 34236,
        created_at: 1,
        content: '',
        sig: 'sig',
        tags: [
          ['d', 'vid-1'],
          ['imeta', 'url https://media.example/v.mp4', 'image https://cdn.example/thumb.jpg', 'm video/mp4'],
        ],
      },
    ]);

    const { result } = renderHook(() => useDiscoveryListPreviews(items), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => {
      expect(result.current.getVideoThumbnail(PUBKEY, 'best')).toBe(
        'https://cdn.example/thumb.jpg',
      );
    });

    // Verify the relay was queried for the right authors + d-tags.
    expect(mockNostrQuery).toHaveBeenCalledWith(
      [
        {
          kinds: [34236],
          authors: [VIDEO_AUTHOR],
          '#d': ['vid-1'],
        },
      ],
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('returns undefined for unknown video lists', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useDiscoveryListPreviews([]), {
      wrapper: makeWrapper(qc),
    });
    expect(result.current.getVideoThumbnail(PUBKEY, 'missing')).toBeUndefined();
  });

  it('skips video lists with malformed first coordinates', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const items: DiscoveryListItem[] = [
      {
        kind: 30005,
        list: {
          id: 'malformed',
          pubkey: PUBKEY,
          name: 'Malformed',
          public: true,
          videoCoordinates: ['not-a-coord'],
          createdAt: 0,
        },
      },
    ];

    renderHook(() => useDiscoveryListPreviews(items), { wrapper: makeWrapper(qc) });

    // The hook's video query should be disabled (no valid coords), so nostr.query never fires.
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });
});
