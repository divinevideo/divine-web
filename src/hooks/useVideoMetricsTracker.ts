// ABOUTME: Hook that tracks video playback metrics like watch duration and loop count
// ABOUTME: Publishes Kind 22236 ephemeral view events for decentralized analytics

import { useEffect, useRef, useCallback } from 'react';
import { useViewEventPublisher, type ViewTrafficSource } from './useViewEventPublisher';
import { debugLog } from '@/lib/debug';
import { trackProductEvent } from '@/lib/analyticsClient';
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
  const publishViewEventRef = useRef(publishViewEvent);
  const sourceRef = useRef(source);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const enabledRef = useRef(enabled);
  const isPlayingRef = useRef(isPlaying);

  publishViewEventRef.current = publishViewEvent;
  sourceRef.current = source;
  isAuthenticatedRef.current = isAuthenticated;
  enabledRef.current = enabled;
  isPlayingRef.current = isPlaying;

  // Track metrics state in a ref to avoid re-renders
  const metricsRef = useRef<VideoMetricsState>({
    lastPosition: 0,
    loopCount: 0,
    hasTrackedView: false,
  });

  // Track the current video ID to detect video changes
  const currentVideoIdRef = useRef<string | null>(null);
  const trackedVideoRef = useRef<ParsedVideoData | null>(video);

  // Track accumulated watch time since last publish
  const watchTimeAccumulatorRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(Date.now());

  // Flush accumulated watch time into the accumulator (call before reading it)
  const flushWatchTime = useCallback((countPlayback = isPlayingRef.current) => {
    const now = Date.now();
    const elapsed = (now - lastUpdateTimeRef.current) / 1000;
    if (countPlayback && elapsed > 0 && elapsed < 10) { // Sanity check: ignore huge gaps (tab was backgrounded)
      watchTimeAccumulatorRef.current += elapsed;
    }
    lastUpdateTimeRef.current = now;
  }, []);

  const trackEngagementSummary = useCallback((currentVideo: ParsedVideoData, watchedSeconds: number) => {
    void trackProductEvent('video_engagement_summary', {
      surface: 'video',
      content_id: currentVideo.id,
      creator_pubkey: currentVideo.pubkey,
      traffic_source: sourceRef.current,
      duration_ms: watchedSeconds * 1000,
      position_ms: 0,
      loop_count: metricsRef.current.loopCount,
      properties: {
        vine_id: currentVideo.vineId,
        watched_seconds: watchedSeconds,
      },
    });
  }, []);

  // Publish a view event and reset the accumulator (stable, reads from refs)
  const publishAndReset = useCallback(async (targetVideo = trackedVideoRef.current) => {
    const currentVideo = targetVideo;
    if (!currentVideo || !enabledRef.current || !isAuthenticatedRef.current) return;

    const rawWatchedSeconds = watchTimeAccumulatorRef.current;
    if (rawWatchedSeconds <= 0) {
      debugLog('[VideoMetricsTracker] Skipping view event: no playback time watched');
      return;
    }

    const watchedSeconds = Math.floor(rawWatchedSeconds);
    debugLog('[VideoMetricsTracker] Publishing view event', {
      videoId: currentVideo.id,
      watchedSeconds,
      loopCount: metricsRef.current.loopCount,
    });

    // Reset accumulator before the async call to prevent double-counting
    watchTimeAccumulatorRef.current = 0;
    lastUpdateTimeRef.current = Date.now();

    trackEngagementSummary(currentVideo, watchedSeconds);

    await publishViewEventRef.current({
      video: currentVideo,
      startSeconds: 0,
      endSeconds: watchedSeconds,
      source: sourceRef.current,
    }).catch((error) => {
      debugLog('[VideoMetricsTracker] Failed to publish view event:', error);
    });
  }, [trackEngagementSummary]); // Reads playback state from refs

  // Reset metrics on a real video id change; keep the tracked object fresh otherwise.
  useEffect(() => {
    const videoId = video?.id ?? null;
    if (!videoId) return;

    const idChanged = currentVideoIdRef.current !== videoId;

    // Only a genuine id change publishes leftovers and resets. A same-id object
    // change (e.g. async ProofMode enrichment handing us a new object with the
    // same id) must NOT reset the accumulator, or mid-play watch time is lost.
    if (idChanged) {
      if (currentVideoIdRef.current) {
        const previousVideo = trackedVideoRef.current;
        flushWatchTime();
        publishAndReset(previousVideo);
      }

      metricsRef.current = {
        lastPosition: 0,
        loopCount: 0,
        hasTrackedView: false,
      };
      watchTimeAccumulatorRef.current = 0;
      lastUpdateTimeRef.current = Date.now();
      currentVideoIdRef.current = videoId;
    }

    // Keep the tracked object current for this id (same id/pubkey/vineId).
    trackedVideoRef.current = video;
  }, [video, video?.id, publishAndReset, flushWatchTime]);

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

    return () => {
      // On pause, render has already set isPlayingRef.current=false; count the slice that just ended.
      flushWatchTime(true);
      clearInterval(interval);
    };
  }, [video?.id, enabled, isPlaying, flushWatchTime]);

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

  // Publish remaining time on actual component unmount.
  useEffect(() => {
    return () => {
      flushWatchTime();
      void publishAndReset();
    };
  }, [flushWatchTime, publishAndReset]);

  // Return current metrics for debugging/display purposes
  return {
    watchedSeconds: Math.floor(watchTimeAccumulatorRef.current),
    loopCount: metricsRef.current.loopCount,
    isTracking: metricsRef.current.hasTrackedView,
  };
}
