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
  viewStartTime: number | null;
  totalWatchDuration: number;
  lastPosition: number;
  loopCount: number;
  hasTrackedView: boolean;
  hasSentEndEvent: boolean;
}

/**
 * Hook that tracks video playback metrics and publishes view events.
 *
 * This enables decentralized creator analytics and recommendation systems
 * by publishing Kind 22236 ephemeral events to Nostr relays.
 *
 * Usage:
 * ```tsx
 * useVideoMetricsTracker({
 *   video,
 *   isPlaying: videoRef.current?.paused === false,
 *   currentTime: videoRef.current?.currentTime || 0,
 *   duration: videoRef.current?.duration || 0,
 *   source: 'discovery',
 * });
 * ```
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

  // Track metrics state in a ref to avoid re-renders
  const metricsRef = useRef<VideoMetricsState>({
    viewStartTime: null,
    totalWatchDuration: 0,
    lastPosition: 0,
    loopCount: 0,
    hasTrackedView: false,
    hasSentEndEvent: false,
  });

  // Track the current video ID to detect video changes
  const currentVideoIdRef = useRef<string | null>(null);

  // Track accumulated watch time during this session
  const watchTimeAccumulatorRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(Date.now());

  // Send view event
  const sendViewEvent = useCallback(async () => {
    const metrics = metricsRef.current;
    if (!video || !enabled || metrics.hasSentEndEvent) return;

    // Only send if we have meaningful watch time (at least 1 second)
    const watchedSeconds = Math.floor(watchTimeAccumulatorRef.current);
    if (watchedSeconds < 1) {
      debugLog('[VideoMetricsTracker] Skipping view event: less than 1 second watched');
      return;
    }

    debugLog('[VideoMetricsTracker] Sending view event', {
      videoId: video.id,
      watchedSeconds,
      loopCount: metrics.loopCount,
    });

    metrics.hasSentEndEvent = true;

    const success = await publishViewEvent({
      video,
      startSeconds: 0,
      endSeconds: watchedSeconds,
      source,
    });

    if (success) {
      debugLog('[VideoMetricsTracker] View event sent successfully');
    }
  }, [video, enabled, source, publishViewEvent]);

  // Reset metrics when video changes
  useEffect(() => {
    if (!video) return;

    // If video changed, send event for previous video and reset
    if (currentVideoIdRef.current && currentVideoIdRef.current !== video.id) {
      sendViewEvent();
    }

    // Reset metrics for new video
    metricsRef.current = {
      viewStartTime: null,
      totalWatchDuration: 0,
      lastPosition: 0,
      loopCount: 0,
      hasTrackedView: false,
      hasSentEndEvent: false,
    };
    watchTimeAccumulatorRef.current = 0;
    lastUpdateTimeRef.current = Date.now();
    currentVideoIdRef.current = video.id;
  }, [video?.id, sendViewEvent]);

  // Track playback time
  useEffect(() => {
    if (!video || !enabled || !isPlaying) return;

    const metrics = metricsRef.current;

    // Start tracking if not already
    if (!metrics.hasTrackedView) {
      metrics.viewStartTime = Date.now();
      metrics.hasTrackedView = true;
      debugLog('[VideoMetricsTracker] Started tracking video', video.id);
    }

    // Update watch time accumulator every second while playing
    const interval = setInterval(() => {
      if (isPlaying) {
        const now = Date.now();
        const elapsed = (now - lastUpdateTimeRef.current) / 1000;
        watchTimeAccumulatorRef.current += elapsed;
        lastUpdateTimeRef.current = now;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [video, enabled, isPlaying]);

  // Detect loops (position jumps back to start near video end)
  useEffect(() => {
    if (!video || !enabled || duration <= 0) return;

    const metrics = metricsRef.current;
    const lastPos = metrics.lastPosition;

    // Detect loop: position jumps back to start after being near the end
    if (
      lastPos > 0 &&
      currentTime < 1 &&
      lastPos > duration - 1
    ) {
      metrics.loopCount++;
      debugLog('[VideoMetricsTracker] Video looped', {
        videoId: video.id,
        loopCount: metrics.loopCount,
      });
    }

    metrics.lastPosition = currentTime;
  }, [video, enabled, currentTime, duration]);

  // Send view event when component unmounts or video changes
  useEffect(() => {
    return () => {
      // Use a timeout to ensure we capture final watch time
      const capturedMetrics = { ...metricsRef.current };
      const capturedWatchTime = watchTimeAccumulatorRef.current;
      const capturedVideo = video;

      // Send event on unmount if we have data
      if (capturedVideo && capturedWatchTime >= 1 && !capturedMetrics.hasSentEndEvent && isAuthenticated) {
        publishViewEvent({
          video: capturedVideo,
          startSeconds: 0,
          endSeconds: Math.floor(capturedWatchTime),
          source,
        }).catch(() => {
          // Ignore errors on unmount
        });
      }
    };
  }, [video, source, publishViewEvent, isAuthenticated]);

  // Return current metrics for debugging/display purposes
  return {
    watchedSeconds: Math.floor(watchTimeAccumulatorRef.current),
    loopCount: metricsRef.current.loopCount,
    isTracking: metricsRef.current.hasTrackedView,
  };
}
