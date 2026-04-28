import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCollabInvites } from './useCollabInvites';
import { TestApp } from '@/test/TestApp';
import type { NostrEvent } from '@nostrify/nostrify';

const ME = 'a'.repeat(64);
const CREATOR = 'b'.repeat(64);

function video(d: string, opts: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'id-' + d + '-' + (opts.created_at ?? 0),
    pubkey: opts.pubkey as string ?? CREATOR,
    created_at: opts.created_at ?? 1700000000,
    kind: 34236,
    content: '',
    tags: [['d', d], ['p', ME], ...(opts.tags ?? [])],
    sig: '',
  };
}

const acceptance = (coord: string): NostrEvent => ({
  id: 'ack-' + coord,
  pubkey: ME,
  created_at: 1700000100,
  kind: 34238,
  content: '',
  tags: [['a', coord], ['d', 'd' + coord]],
  sig: '',
});

const queryMock = vi.fn();

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: ME }, signer: undefined }),
}));

vi.mock('@nostrify/react', async () => {
  const actual = await vi.importActual<typeof import('@nostrify/react')>('@nostrify/react');
  return {
    ...actual,
    useNostr: () => ({ nostr: { query: queryMock, event: vi.fn() } }),
  };
});

beforeEach(() => {
  queryMock.mockReset();
});

describe('useCollabInvites', () => {
  it('returns [] when no videos tag the user', async () => {
    queryMock.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useCollabInvites(), { wrapper: TestApp });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('drops videos the user has already accepted', async () => {
    const v1 = video('vid1');
    const v2 = video('vid2');
    queryMock
      .mockResolvedValueOnce([v1, v2])
      .mockResolvedValueOnce([acceptance(`34236:${CREATOR}:vid1`)]);
    const { result } = renderHook(() => useCollabInvites(), { wrapper: TestApp });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((v) => v.tags.find((t) => t[0] === 'd')?.[1])).toEqual(['vid2']);
  });

  it('keeps only the latest version of an addressable coord', async () => {
    const older = video('vid1', { created_at: 1000 });
    const newer = video('vid1', { created_at: 2000 });
    queryMock.mockResolvedValueOnce([older, newer]).mockResolvedValueOnce([]);
    const { result } = renderHook(() => useCollabInvites(), { wrapper: TestApp });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].id).toBe(newer.id);
  });

  it('drops self-tagged videos', async () => {
    queryMock
      .mockResolvedValueOnce([video('vid1', { pubkey: ME })])
      .mockResolvedValueOnce([]);
    const { result } = renderHook(() => useCollabInvites(), { wrapper: TestApp });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
