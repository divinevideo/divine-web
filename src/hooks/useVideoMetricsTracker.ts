// ABOUTME: Hook that tracks video playback metrics like watch duration and loop count
// ABOUTME: Publishes Kind 22236 ephemeral view events for decentralized analytics

import { useEffect, useRef, useCallback } from 'react';
import { useViewEventPublisher, type ViewTrafficSource } from './useViewEventPublisher';
import { debugLog } from '@/lib/debug';
import type { ParsedVideoData } from '@/types/video';

interface UseVideoMetricsTrackerOptions {
  video: ParsedVideoData | null;
  isPlaying: boolean;
  currentTime: number;  // Current playback position in seconds
  duration: number;     // Total video duration in seconds
  source?: ViewTrafficSource;
  enabled?: boolean;
}

interface VideoMetricsState {
  lastPosition: number;
  loopCount: number;
  hasTrackedView: boolean;
}

/**
 * Hook that tracks video playback metrics and publishes view events.
 *
 * Publishes a Kind 22236 ephemeral event:
 * - Once per loop (when video restarts from the end)
 * - On component unmount (remaining partial-loop time)
 * - On video change (remaining partial-loop time)
 *
 * Uses refs for all callback/effect dependencies to prevent the `video`
 * object reference from causing spurious effect re-runs and duplicate publishes.
 */
export function useVideoMetricsTracker({
  video,
  isPlaying,
  currentTime,
  duration,
  source = 'unknown',
  enabled = true,
}: UseVideoMetricsTrackerOptions) {
  const { publishViewEvent, isAuthenticated } = useViewEventPublisher();

  // Store props/callbacks in refs so effects don't re-run on object reference changes.
  const videoRef = useRef(video);
  const publishViewEventRef = useRef(publishViewEvent);
  const sourceRef = useRef(source);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const enabledRef = useRef(enabled);

  videoRef.current = video;
  publishViewEventRef.current = publishViewEvent;
  sourceRef.current = source;
  isAuthenticatedRef.current = isAuthenticated;
  enabledRef.current = enabled;

  // Track metrics state in a ref to avoid re-renders
  const metricsRef = useRef<VideoMetricsState>({
    lastPosition: 0,
    loopCount: 0,
    hasTrackedView: false,
  });

  // Track the current video ID to detect video changes
  const currentVideoIdRef = useRef<string | null>(null);

  // Track accumulated watch time since last publish
  const watchTimeAccumulatorRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(Date.now());

  // Flush accumulated watch time into the accumulator (call before reading it)
  const flushWatchTime = useCallback(() => {
    const now = Date.now();
    const elapsed = (now - lastUpdateTimeRef.current) / 1000;
    if (elapsed > 0 && elapsed < 10) { // Sanity check: ignore huge gaps (tab was backgrounded)
      watchTimeAccumulatorRef.current += elapsed;
    }
    lastUpdateTimeRef.current = now;
  }, []);

  // Publish a view event and reset the accumulator (stable, reads from refs)
  const publishAndReset = useCallback(async () => {
    const currentVideo = videoRef.current;
    if (!currentVideo || !enabledRef.current || !isAuthenticatedRef.current) return;

    const watchedSeconds = Math.floor(watchTimeAccumulatorRef.current);
    if (watchedSeconds < 1) {
      debugLog('[VideoMetricsTracker] Skipping view event: less than 1 second watched');
      return;
    }

    debugLog('[VideoMetricsTracker] Publishing view event', {
      videoId: currentVideo.id,
      watchedSeconds,
      loopCount: metricsRef.current.loopCount,
    });

    // Reset accumulator before the async call to prevent double-counting
    watchTimeAccumulatorRef.current = 0;
    lastUpdateTimeRef.current = Date.now();

    await publishViewEventRef.current({
      video: currentVideo,
      startSeconds: 0,
      endSeconds: watchedSeconds,
      source: sourceRef.current,
    }).catch((error) => {
      debugLog('[VideoMetricsTracker] Failed to publish view event:', error);
    });
  }, []); // No deps — reads everything from refs

  // Reset metrics when video ID changes (primitive comparison, stable)
  useEffect(() => {
    const videoId = video?.id ?? null;
    if (!videoId) return;

    // If video changed, publish remaining time for previous video
    if (currentVideoIdRef.current && currentVideoIdRef.current !== videoId) {
      flushWatchTime();
      publishAndReset();
    }

    // Reset metrics for new video
    metricsRef.current = {
      lastPosition: 0,
      loopCount: 0,
      hasTrackedView: false,
    };
    watchTimeAccumulatorRef.current = 0;
    lastUpdateTimeRef.current = Date.now();
    currentVideoIdRef.current = videoId;
  }, [video?.id, publishAndReset, flushWatchTime]);

  // Track playback time — depends only on primitives
  useEffect(() => {
    if (!video?.id || !enabled || !isPlaying) return;

    const metrics = metricsRef.current;

    // Start tracking if not already
    if (!metrics.hasTrackedView) {
      metrics.hasTrackedView = true;
      lastUpdateTimeRef.current = Date.now();
      debugLog('[VideoMetricsTracker] Started tracking video', video.id);
    }

    // Reset the last update time when playback resumes after pause
    lastUpdateTimeRef.current = Date.now();

    // Update watch time accumulator every second while playing
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastUpdateTimeRef.current) / 1000;
      if (elapsed > 0 && elapsed < 10) {
        watchTimeAccumulatorRef.current += elapsed;
      }
      lastUpdateTimeRef.current = now;
    }, 1000);

    return () => clearInterval(interval);
  }, [video?.id, enabled, isPlaying]);

  // Detect loops and publish once per loop
  useEffect(() => {
    if (!video?.id || !enabled || duration <= 0) return;

    const metrics = metricsRef.current;
    const lastPos = metrics.lastPosition;

    // Detect loop: position jumps back to start after being near the end
    if (
      lastPos > 0 &&
      currentTime < 1 &&
      lastPos >= duration - 1
    ) {
      metrics.loopCount++;
      debugLog('[VideoMetricsTracker] Video looped', {
        videoId: video.id,
        loopCount: metrics.loopCount,
      });

      // Flush and publish for this completed loop
      flushWatchTime();
      publishAndReset();
    }

    metrics.lastPosition = currentTime;
  }, [video?.id, enabled, currentTime, duration, flushWatchTime, publishAndReset]);

  // Publish remaining time on actual component unmount (empty deps)
  useEffect(() => {
    return () => {
      const currentVideo = videoRef.current;
      const watchedSeconds = Math.floor(watchTimeAccumulatorRef.current);

      if (currentVideo && watchedSeconds >= 1 && isAuthenticatedRef.current && enabledRef.current) {
        publishViewEventRef.current({
          video: currentVideo,
          startSeconds: 0,
          endSeconds: watchedSeconds,
          source: sourceRef.current,
        }).catch(() => {
          // Ignore errors on unmount
        });
      }
    };
  }, []); // Empty deps — fires only on unmount

  // Return current metrics for debugging/display purposes
  return {
    watchedSeconds: Math.floor(watchTimeAccumulatorRef.current),
    loopCount: metricsRef.current.loopCount,
    isTracking: metricsRef.current.hasTrackedView,
  };
}
