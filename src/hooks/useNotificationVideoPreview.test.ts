import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchVideoById } from '@/lib/funnelcakeClient';
import { useNotificationVideoPreview } from './useNotificationVideoPreview';

vi.mock('@/lib/funnelcakeClient', () => ({ fetchVideoById: vi.fn() }));

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe('useNotificationVideoPreview', () => {
  beforeEach(() => vi.resetAllMocks());

  it('does not request metadata before the row needs its fallback', () => {
    renderHook(() => useNotificationVideoPreview('a'.repeat(64), false), { wrapper: createWrapper() });
    expect(fetchVideoById).not.toHaveBeenCalled();
  });

  it.each([
    [{ age_restricted: true }, true],
    [{ moderation_status: 'age_restricted' }, true],
    [{}, false],
  ])('returns the fallback URL with restriction metadata %j', async (restriction, expected) => {
    vi.mocked(fetchVideoById).mockResolvedValue({
      video_url: 'https://example.com/loop.mp4', ...restriction,
    } as Awaited<ReturnType<typeof fetchVideoById>>);
    const { result } = renderHook(() => useNotificationVideoPreview('a'.repeat(64), true), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ videoUrl: 'https://example.com/loop.mp4', ageRestricted: expected });
  });

  it('leaves the fallback unavailable if the video lookup returns nothing', async () => {
    vi.mocked(fetchVideoById).mockResolvedValue(null);
    const { result } = renderHook(() => useNotificationVideoPreview('a'.repeat(64), true), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
