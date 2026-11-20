import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
import { VIDEO_REFERENCE_KINDS } from '@/types/video';
import { useVideoEvents } from './useVideoEvents';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@nostrify/react', () => ({ useNostr: () => ({ nostr: { query } }) }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: null }) }));
vi.mock('@/hooks/useFollowList', () => ({ useFollowList: () => ({ data: [] }) }));

function Wrapper({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return React.createElement(QueryClientProvider, { client }, children);
}

function event(kind: number, id: string, dTag?: string): NostrEvent {
  return {
    id, pubkey: 'a'.repeat(64), kind, created_at: 1, content: '', sig: 'b'.repeat(128),
    tags: [...(dTag ? [['d', dTag]] : []), ['imeta', 'url https://example.com/clip.mp4', 'm video/mp4']],
  };
}

describe('explicit video reference lookups', () => {
  beforeEach(() => query.mockReset());

  it('loads separate regular events without d tags by their exact IDs', async () => {
    const ids = ['b'.repeat(64), 'c'.repeat(64)];
    query.mockResolvedValue([event(22, ids[0]), event(22, ids[1])]);
    const { result } = renderHook(() => useVideoEvents({ filter: { ids }, acceptedKinds: VIDEO_REFERENCE_KINDS }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map(video => video.id)).toEqual(ids);
    expect(query.mock.calls[0][0][0].kinds).toEqual(VIDEO_REFERENCE_KINDS);
    expect(result.current.data?.map(video => video.kind)).toEqual([22, 22]);
  });

  it('loads an addressable normal video by its complete coordinate', async () => {
    const id = 'b'.repeat(64);
    query.mockResolvedValue([event(34235, id, 'clip')]);
    const { result } = renderHook(() => useVideoEvents({
      filter: { kinds: [34235], authors: ['a'.repeat(64)], '#d': ['clip'] },
      acceptedKinds: VIDEO_REFERENCE_KINDS,
    }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.id).toBe(id);
    expect(result.current.data?.[0]?.kind).toBe(34235);
  });

  it('keeps ordinary feed parsing on its existing supported kinds', async () => {
    const id = 'b'.repeat(64);
    query.mockResolvedValue([event(22, id)]);
    const { result } = renderHook(() => useVideoEvents({ filter: { ids: [id] } }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(query.mock.calls[0][0][0].kinds).toEqual([34236]);
  });
});
