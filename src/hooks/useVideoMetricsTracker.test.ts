// ABOUTME: Tests for useVideoMetricsTracker hook
// ABOUTME: Verifies per-loop publishing, accumulation, and guard conditions

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVideoMetricsTracker } from './useVideoMetricsTracker';
import type { ParsedVideoData } from '@/types/video';

// Mock the view event publisher
const mockPublishViewEvent = vi.fn().mockResolvedValue(true);
vi.mock('./useViewEventPublisher', () => ({
  useViewEventPublisher: () => ({
    publishViewEvent: mockPublishViewEvent,
    isAuthenticated: true,
  }),
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

const makeVideo = (id: string): ParsedVideoData => ({
  id,
  pubkey: 'abc123pubkey',
  vineId: `vine-${id}`,
  videoUrl: `https://example.com/${id}.mp4`,
  thumbnailUrl: '',
  title: 'Test Video',
  content: '',
  createdAt: 1700000000,
  kind: 34236 as const,
  hashtags: [],
  fallbackVideoUrls: [],
  reposts: [],
  isVineMigrated: false,
});

describe('useVideoMetricsTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not publish when disabled', () => {
    const video = makeVideo('v1');
    const { unmount } = renderHook(() =>
      useVideoMetricsTracker({
        video,
        isPlaying: true,
        currentTime: 3,
        duration: 6,
        enabled: false,
      })
    );

    act(() => { vi.advanceTimersByTime(5000); });
    unmount();

    expect(mockPublishViewEvent).not.toHaveBeenCalled();
  });

  it('does not publish when video is null', () => {
    const { unmount } = renderHook(() =>
      useVideoMetricsTracker({
        video: null,
        isPlaying: true,
        currentTime: 0,
        duration: 6,
      })
    );

    act(() => { vi.advanceTimersByTime(5000); });
    unmount();

    expect(mockPublishViewEvent).not.toHaveBeenCalled();
  });

  it('does not publish for less than 1 second of watch time', () => {
    const video = makeVideo('v1');
    const { unmount } = renderHook(() =>
      useVideoMetricsTracker({
        video,
        isPlaying: true,
        currentTime: 0,
        duration: 6,
      })
    );

    // Only 500ms — not enough
    act(() => { vi.advanceTimersByTime(500); });
    unmount();

    expect(mockPublishViewEvent).not.toHaveBeenCalled();
  });

  it('publishes remaining time on unmount', () => {
    const video = makeVideo('v1');
    const { unmount } = renderHook(() =>
      useVideoMetricsTracker({
        video,
        isPlaying: true,
        currentTime: 3,
        duration: 6,
      })
    );

    // Accumulate 3 seconds
    act(() => { vi.advanceTimersByTime(3000); });
    unmount();

    expect(mockPublishViewEvent).toHaveBeenCalledTimes(1);
    expect(mockPublishViewEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        video,
        startSeconds: 0,
        source: 'unknown',
      })
    );
    const call = mockPublishViewEvent.mock.calls[0][0];
    expect(call.endSeconds).toBeGreaterThanOrEqual(2);
    expect(call.endSeconds).toBeLessThanOrEqual(4);
  });

  it('does NOT publish on every re-render when video object reference changes', () => {
    const { rerender, unmount } = renderHook(
      ({ video }) =>
        useVideoMetricsTracker({
          video,
          isPlaying: true,
          currentTime: 3,
          duration: 6,
        }),
      { initialProps: { video: makeVideo('v1') } }
    );

    act(() => { vi.advanceTimersByTime(2000); });

    // Re-render with new object reference, same ID — should NOT publish
    rerender({ video: makeVideo('v1') });
    act(() => { vi.advanceTimersByTime(1000); });
    rerender({ video: makeVideo('v1') });
    act(() => { vi.advanceTimersByTime(1000); });

    expect(mockPublishViewEvent).not.toHaveBeenCalled();

    unmount();
    expect(mockPublishViewEvent).toHaveBeenCalledTimes(1);
  });

  it('publishes on each loop, then remaining time on unmount', () => {
    const video = makeVideo('v1');

    const { rerender, unmount } = renderHook(
      ({ currentTime }) =>
        useVideoMetricsTracker({
          video,
          isPlaying: true,
          currentTime,
          duration: 6,
        }),
      { initialProps: { currentTime: 0 } }
    );

    // Play through first loop: 0 → 5 → 0
    act(() => { vi.advanceTimersByTime(3000); });
    rerender({ currentTime: 3 });
    act(() => { vi.advanceTimersByTime(2000); });
    rerender({ currentTime: 5 });
    act(() => { vi.advanceTimersByTime(1000); });

    // Loop back to start — should trigger publish
    rerender({ currentTime: 0 });

    expect(mockPublishViewEvent).toHaveBeenCalledTimes(1);
    const firstCall = mockPublishViewEvent.mock.calls[0][0];
    expect(firstCall.startSeconds).toBe(0);
    expect(firstCall.endSeconds).toBeGreaterThanOrEqual(4);

    // Play through second loop
    act(() => { vi.advanceTimersByTime(3000); });
    rerender({ currentTime: 3 });
    act(() => { vi.advanceTimersByTime(3000); });
    rerender({ currentTime: 5 });

    // Loop again
    rerender({ currentTime: 0 });

    expect(mockPublishViewEvent).toHaveBeenCalledTimes(2);

    // Partial third loop, then unmount
    act(() => { vi.advanceTimersByTime(2000); });
    rerender({ currentTime: 2 });
    unmount();

    // Remaining time published on unmount
    expect(mockPublishViewEvent).toHaveBeenCalledTimes(3);
  });

  it('publishes remaining time when video changes', () => {
    const video1 = makeVideo('v1');
    const video2 = makeVideo('v2');

    const { rerender, unmount } = renderHook(
      ({ video }) =>
        useVideoMetricsTracker({
          video,
          isPlaying: true,
          currentTime: 3,
          duration: 6,
        }),
      { initialProps: { video: video1 } }
    );

    // Watch video1 for 2 seconds
    act(() => { vi.advanceTimersByTime(2000); });

    // Switch to video2 — should publish remaining for video1
    rerender({ video: video2 });
    act(() => { vi.advanceTimersByTime(2000); });

    expect(mockPublishViewEvent).toHaveBeenCalledTimes(1);

    unmount();
    // Also publishes for video2
    expect(mockPublishViewEvent).toHaveBeenCalledTimes(2);
  });

  it('does not accumulate time while paused', () => {
    const video = makeVideo('v1');
    const { rerender, unmount } = renderHook(
      ({ isPlaying }) =>
        useVideoMetricsTracker({
          video,
          isPlaying,
          currentTime: 0,
          duration: 6,
        }),
      { initialProps: { isPlaying: true } }
    );

    // Play for 2 seconds
    act(() => { vi.advanceTimersByTime(2000); });

    // Pause for 5 seconds
    rerender({ isPlaying: false });
    act(() => { vi.advanceTimersByTime(5000); });

    unmount();

    if (mockPublishViewEvent.mock.calls.length > 0) {
      const call = mockPublishViewEvent.mock.calls[0][0];
      expect(call.endSeconds).toBeLessThanOrEqual(3);
    }
  });

  it('passes traffic source through to publish call', () => {
    const video = makeVideo('v1');
    const { unmount } = renderHook(() =>
      useVideoMetricsTracker({
        video,
        isPlaying: true,
        currentTime: 3,
        duration: 6,
        source: 'trending',
      })
    );

    act(() => { vi.advanceTimersByTime(3000); });
    unmount();

    expect(mockPublishViewEvent).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'trending' })
    );
  });

  it('detects video loops and increments loopCount', () => {
    const video = makeVideo('v1');
    const { rerender, result } = renderHook(
      ({ currentTime }) =>
        useVideoMetricsTracker({
          video,
          isPlaying: true,
          currentTime,
          duration: 6,
        }),
      { initialProps: { currentTime: 0 } }
    );

    // Play to near end
    rerender({ currentTime: 5 });
    // Loop back to start
    rerender({ currentTime: 0 });
    // Read updated loopCount on next render
    rerender({ currentTime: 1 });

    expect(result.current.loopCount).toBe(1);

    // Another loop
    rerender({ currentTime: 5 });
    rerender({ currentTime: 0 });
    rerender({ currentTime: 1 });

    expect(result.current.loopCount).toBe(2);
  });
});
