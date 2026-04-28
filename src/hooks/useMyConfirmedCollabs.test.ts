import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMyConfirmedCollabs } from './useMyConfirmedCollabs';
import { TestApp } from '@/test/TestApp';

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: 'a'.repeat(64) } }),
}));

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockReset();
});

const stubVideo = (id: string) => ({
  id,
  pubkey: 'b'.repeat(64),
  created_at: 1700000000,
  kind: 34236,
  d_tag: 'd-' + id,
  title: 'Title ' + id,
  video_url: 'https://x/' + id,
});

describe('useMyConfirmedCollabs', () => {
  it('returns the video list from the raw-array shape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([stubVideo('a'), stubVideo('b')])));
    const { result } = renderHook(() => useMyConfirmedCollabs(), { wrapper: TestApp });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('returns the video list from the {data,pagination} envelope shape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      data: [stubVideo('a')],
      pagination: { has_more: false },
    })));
    const { result } = renderHook(() => useMyConfirmedCollabs(), { wrapper: TestApp });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((v) => v.id)).toEqual(['a']);
  });
});
