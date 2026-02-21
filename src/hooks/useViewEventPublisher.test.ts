// ABOUTME: Tests for useViewEventPublisher hook
// ABOUTME: Verifies Kind 22236 event structure, validation, and publishing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewEventPublisher, VIEW_EVENT_KIND } from './useViewEventPublisher';
import type { ParsedVideoData } from '@/types/video';

const mockPublishEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: mockPublishEvent,
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: 'userpubkey123' },
  }),
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: { relayUrl: 'wss://relay.divine.video' },
  }),
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

const makeVideo = (overrides?: Partial<ParsedVideoData>): ParsedVideoData => ({
  id: 'event-id-abc',
  pubkey: 'author-pubkey-xyz',
  vineId: 'vine-123',
  videoUrl: 'https://cdn.example.com/video.mp4',
  thumbnailUrl: '',
  title: 'Test',
  content: '',
  createdAt: 1700000000,
  kind: 34236 as const,
  hashtags: [],
  fallbackVideoUrls: [],
  reposts: [],
  isVineMigrated: false,
  ...overrides,
});

describe('useViewEventPublisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishes Kind 22236 with correct tag structure', async () => {
    const { result } = renderHook(() => useViewEventPublisher());
    const video = makeVideo();

    let success: boolean = false;
    await act(async () => {
      success = await result.current.publishViewEvent({
        video,
        startSeconds: 0,
        endSeconds: 5,
        source: 'discovery',
      });
    });

    expect(success).toBe(true);
    expect(mockPublishEvent).toHaveBeenCalledTimes(1);

    const call = mockPublishEvent.mock.calls[0][0];
    expect(call.kind).toBe(VIEW_EVENT_KIND);
    expect(call.kind).toBe(22236);
    expect(call.content).toBe('');

    // Verify tag structure matches divine-mobile format
    const tags = call.tags as string[][];
    expect(tags).toEqual([
      ['a', '34236:author-pubkey-xyz:vine-123', 'wss://relay.divine.video'],
      ['e', 'event-id-abc', 'wss://relay.divine.video'],
      ['viewed', '0', '5'],
      ['source', 'discovery'],
      ['client', 'divine-web/1.0'],
    ]);
  });

  it('skips publishing when watch time is less than 1 second', async () => {
    const { result } = renderHook(() => useViewEventPublisher());

    let success: boolean = true;
    await act(async () => {
      success = await result.current.publishViewEvent({
        video: makeVideo(),
        startSeconds: 0,
        endSeconds: 0,
      });
    });

    expect(success).toBe(false);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('skips publishing when endSeconds <= startSeconds', async () => {
    const { result } = renderHook(() => useViewEventPublisher());

    let success: boolean = true;
    await act(async () => {
      success = await result.current.publishViewEvent({
        video: makeVideo(),
        startSeconds: 5,
        endSeconds: 3,
      });
    });

    expect(success).toBe(false);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('skips publishing when video has no vineId', async () => {
    const { result } = renderHook(() => useViewEventPublisher());

    let success: boolean = true;
    await act(async () => {
      success = await result.current.publishViewEvent({
        video: makeVideo({ vineId: undefined }),
        startSeconds: 0,
        endSeconds: 5,
      });
    });

    expect(success).toBe(false);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('defaults source to unknown when not specified', async () => {
    const { result } = renderHook(() => useViewEventPublisher());

    await act(async () => {
      await result.current.publishViewEvent({
        video: makeVideo(),
        startSeconds: 0,
        endSeconds: 5,
      });
    });

    const tags = mockPublishEvent.mock.calls[0][0].tags as string[][];
    const sourceTag = tags.find((t: string[]) => t[0] === 'source');
    expect(sourceTag).toEqual(['source', 'unknown']);
  });

  it('reports isAuthenticated correctly', () => {
    const { result } = renderHook(() => useViewEventPublisher());
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('returns false when publish throws', async () => {
    mockPublishEvent.mockRejectedValueOnce(new Error('relay error'));
    const { result } = renderHook(() => useViewEventPublisher());

    let success: boolean = true;
    await act(async () => {
      success = await result.current.publishViewEvent({
        video: makeVideo(),
        startSeconds: 0,
        endSeconds: 5,
      });
    });

    expect(success).toBe(false);
  });
});
