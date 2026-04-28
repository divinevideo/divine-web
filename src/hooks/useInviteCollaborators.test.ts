import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInviteCollaborators } from './useInviteCollaborators';
import { TestApp } from '@/test/TestApp';
import type { NostrEvent } from '@nostrify/nostrify';

const ME = 'm'.repeat(64);
const TOM = 't'.repeat(64);
const SONY = 's'.repeat(64);

const queryMock = vi.fn();
const publishMutate = vi.fn();
const invalidateQueries = vi.fn();

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: ME } }),
}));
vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({ mutateAsync: publishMutate }),
}));
vi.mock('@nostrify/react', async () => {
  const actual = await vi.importActual<typeof import('@nostrify/react')>('@nostrify/react');
  return {
    ...actual,
    useNostr: () => ({ nostr: { query: queryMock, event: vi.fn() } }),
  };
});
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return { ...actual, useQueryClient: () => ({ invalidateQueries }) };
});

const baseVideo: NostrEvent = {
  id: 'orig',
  pubkey: ME,
  created_at: 1000,
  kind: 34236,
  content: 'desc',
  tags: [
    ['d', 'vid1'],
    ['title', 'Hello'],
    ['imeta', 'url https://x', 'm video/mp4'],
    ['p', SONY, 'studio'],
  ],
  sig: '',
};

beforeEach(() => {
  queryMock.mockReset();
  publishMutate.mockReset();
  invalidateQueries.mockReset();
  publishMutate.mockResolvedValue({ id: 'new' });
});

describe('useInviteCollaborators', () => {
  it('republishes with the absolute-latest version, appending new p-tags', async () => {
    const newer: NostrEvent = {
      ...baseVideo,
      id: 'newer',
      created_at: 2000,
      tags: [...baseVideo.tags, ['t', 'after-edit']],
    };
    queryMock.mockResolvedValueOnce([newer]);

    const { result } = renderHook(() => useInviteCollaborators(), { wrapper: TestApp });
    await act(async () => {
      await result.current.mutateAsync({
        original: baseVideo,
        additions: [{ pubkey: TOM, role: 'actor' }],
      });
    });

    const sent = publishMutate.mock.calls[0][0];
    expect(sent.kind).toBe(34236);
    expect(sent.content).toBe(newer.content);
    for (const t of newer.tags) {
      expect(sent.tags).toContainEqual(t);
    }
    expect(sent.tags).toContainEqual(['p', TOM, 'actor']);
    expect(sent.tags.find((t: string[]) => t[0] === 'd')?.[1]).toBe('vid1');
  });

  it('skips collaborators already present in the latest event', async () => {
    queryMock.mockResolvedValueOnce([baseVideo]);
    const { result } = renderHook(() => useInviteCollaborators(), { wrapper: TestApp });
    await act(async () => {
      await result.current.mutateAsync({
        original: baseVideo,
        additions: [{ pubkey: SONY, role: 'studio' }],
      });
    });
    expect(publishMutate).not.toHaveBeenCalled();
  });

  it('treats already-present collaborators as duplicates even with a different role', async () => {
    // Pinning the chosen behavior: dedup is by pubkey only, not by (pubkey, role).
    queryMock.mockResolvedValueOnce([baseVideo]);
    const { result } = renderHook(() => useInviteCollaborators(), { wrapper: TestApp });
    await act(async () => {
      await result.current.mutateAsync({
        original: baseVideo,
        additions: [{ pubkey: SONY, role: 'actor' }],
      });
    });
    expect(publishMutate).not.toHaveBeenCalled();
  });

  it('falls back to the supplied event if the relay returns nothing', async () => {
    queryMock.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useInviteCollaborators(), { wrapper: TestApp });
    await act(async () => {
      await result.current.mutateAsync({
        original: baseVideo,
        additions: [{ pubkey: TOM }],
      });
    });
    const sent = publishMutate.mock.calls[0][0];
    expect(sent.tags).toContainEqual(['p', TOM]);
    expect(sent.tags).toContainEqual(['d', 'vid1']);
  });
});
