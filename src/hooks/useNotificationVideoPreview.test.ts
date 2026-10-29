import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotificationVideoPreview } from './useNotificationVideoPreview';

const HASH = 'b'.repeat(64);
const VIDEO_ID = 'a'.repeat(64);
const VIDEO_URL = `https://example.com/${HASH}.mp4`;

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

function mockVideoResponse(url = VIDEO_URL, hash?: string) {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
    event: {
      id: VIDEO_ID, pubkey: 'c'.repeat(64), created_at: 100, kind: 34236,
      tags: [['d', 'loop'], ['imeta', `url ${url}`, ...(hash ? [`x ${hash}`] : [])]],
      content: '', sig: '',
    },
    stats: { reactions: 0, comments: 0, reposts: 0, engagement_score: 0, trending_score: 0 },
  }), { status: 200 }));
}

describe('useNotificationVideoPreview', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('does not request metadata before the row needs its fallback', () => {
    renderHook(() => useNotificationVideoPreview(VIDEO_ID, false), { wrapper: createWrapper() });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([true, false])('checks moderation after the real direct lookup (restricted: %s)', async (restricted) => {
    mockVideoResponse();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ age_restricted: restricted }), { status: 200 }));
    const { result } = renderHook(() => useNotificationVideoPreview(VIDEO_ID, true), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ videoUrl: VIDEO_URL, ageRestricted: restricted });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[1][0]).toContain(HASH);
  });

  it('uses the imeta hash when the media URL does not contain one', async () => {
    mockVideoResponse('https://example.com/loop.mp4', HASH);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ age_restricted: true }), { status: 200 }));
    const { result } = renderHook(() => useNotificationVideoPreview(VIDEO_ID, true), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.ageRestricted).toBe(true);
    expect(vi.mocked(fetch).mock.calls[1][0]).toContain(HASH);
  });

  it('keeps the placeholder when no moderation hash can be resolved', async () => {
    mockVideoResponse('https://example.com/loop.mp4');
    const { result } = renderHook(() => useNotificationVideoPreview(VIDEO_ID, true), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the placeholder when moderation is unavailable', async () => {
    mockVideoResponse();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 503 }));
    const { result } = renderHook(() => useNotificationVideoPreview(VIDEO_ID, true), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it.each(['blocked', 'quarantined'])('keeps the placeholder when moderation reports the video %s', async (flag) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ age_restricted: false, [flag]: true }), { status: 200 }));
    const { result } = renderHook(() => useNotificationVideoPreview(VIDEO_ID, true, VIDEO_URL), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('uses a hydrated hashed URL without another video lookup', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ age_restricted: false }), { status: 200 }));
    const { result } = renderHook(() => useNotificationVideoPreview(VIDEO_ID, true, VIDEO_URL), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ videoUrl: VIDEO_URL, ageRestricted: false });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(`https://moderation-api.divine.video/check-result/${HASH}`);
  });
});
