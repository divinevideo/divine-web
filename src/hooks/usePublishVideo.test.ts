// ABOUTME: Tests for NIP-71 publish and kind 16 repost hooks
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { SHORT_VIDEO_KIND } from '@/types/video';

const publishAsync = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    id: 'evt1',
    pubkey: 'p'.repeat(64),
    sig: 's'.repeat(128),
    kind: 34236,
    tags: [],
    content: '',
    created_at: 1,
  })
);

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: publishAsync,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('usePublishVideo', () => {
  let usePublishVideo: typeof import('./usePublishVideo').usePublishVideo;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./usePublishVideo');
    usePublishVideo = mod.usePublishVideo;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls publishEvent with NIP-71 tags and defaults', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00.000Z'));
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const { result } = renderHook(() => usePublishVideo(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        content: 'Alt copy',
        videoUrl: 'https://cdn.example.com/video.mp4',
        title: 'Hi',
        hashtags: ['#Coffee'],
      });
    });

    expect(publishAsync).toHaveBeenCalledTimes(1);
    const call = publishAsync.mock.calls[0]![0];

    expect(call.kind).toBe(SHORT_VIDEO_KIND);
    expect(call.content).toBe('Alt copy');

    expect(call.tags).toEqual([
      ['d', 'vine-1717243200000-i'],
      ['title', 'Hi'],
      ['published_at', '1717243200'],
      [
        'imeta',
        'url',
        'https://cdn.example.com/video.mp4',
        'm',
        'video/mp4',
        'dim',
        '480x480',
        'duration',
        '6',
      ],
      ['duration', '6'],
      ['t', 'coffee'],
      ['alt', 'Alt copy'],
      ['client', 'divine-web'],
    ]);

    vi.useRealTimers();
  });

  it('uses Untitled when title missing', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00.000Z'));
    vi.spyOn(Math, 'random').mockReturnValue(0.25);

    const { result } = renderHook(() => usePublishVideo(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        content: '',
        videoUrl: 'https://x.gif',
      });
    });

    const tags = publishAsync.mock.calls[0]![0].tags;
    expect(tags?.find((t) => t[0] === 'title')).toEqual(['title', 'Untitled']);
    const imeta = tags?.find((t) => t[0] === 'imeta');
    expect(imeta).toContain('image/gif');

    vi.useRealTimers();
  });

  it('passes fixed vineId when provided', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00.000Z'));

    const { result } = renderHook(() => usePublishVideo(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        content: '',
        videoUrl: 'https://a.mp4',
        vineId: 'my-fixed-id',
      });
    });

    expect(publishAsync.mock.calls[0]![0].tags?.[0]).toEqual(['d', 'my-fixed-id']);

    vi.useRealTimers();
  });
});

describe('useRepostVideo', () => {
  let useRepostVideo: typeof import('./usePublishVideo').useRepostVideo;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./usePublishVideo');
    useRepostVideo = mod.useRepostVideo;
  });

  it('calls publishEvent with kind 16 and address tags', async () => {
    const { result } = renderHook(() => useRepostVideo(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        originalPubkey: 'b'.repeat(64),
        vineId: 'vine-123',
      });
    });

    expect(publishAsync).toHaveBeenCalledWith({
      kind: 16,
      content: '',
      tags: [
        ['a', `${SHORT_VIDEO_KIND}:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:vine-123`],
        ['p', 'b'.repeat(64)],
        ['k', String(SHORT_VIDEO_KIND)],
        ['client', 'divine-web'],
      ],
    });
  });
});
