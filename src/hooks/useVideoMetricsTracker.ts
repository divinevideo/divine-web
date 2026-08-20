// ABOUTME: Publishes public Nostr view counts and one private aggregate per playback session.
// ABOUTME: Records an impression only after a video stays at least half visible for one second.

import { useCallback, useEffect, useRef } from 'react';

import type { ProductAnalyticsV2Surface } from '@/generated/productAnalytics';
import { trackProductEvent } from '@/lib/analyticsClient';
import { debugLog } from '@/lib/debug';
import type { ParsedVideoData } from '@/types/video';
import { useViewEventPublisher, type ViewTrafficSource } from './useViewEventPublisher';

interface UseVideoMetricsTrackerOptions {
  video: ParsedVideoData | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  source?: ViewTrafficSource;
  enabled?: boolean;
  visibilityRatio?: number;
  position?: number;
}

interface VideoMetricsState {
  lastPosition: number;
  loopCount: number;
  hasTrackedView: boolean;
}

interface ProductPlaybackState {
  playbackSessionId: string;
  contentId: string;
  surface: ProductAnalyticsV2Surface;
  durationMs: number;
  watchedMs: number;
  loopCount: number;
  started: boolean;
}

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (Number(char) ^ (random & (15 >> (Number(char) / 4)))).toString(16);
  });
}

function getSurface(source: ViewTrafficSource): ProductAnalyticsV2Surface {
  if (source === 'home') return 'feed';
  if (source === 'profile') return 'profile';
  if (source === 'search') return 'search_results';
  if (source === 'discovery' || source === 'trending' || source === 'hashtag') return 'discovery';
  return 'unknown';
}

function newProductPlayback(
  video: ParsedVideoData | null,
  source: ViewTrafficSource,
  duration: number,
): ProductPlaybackState {
  return {
    playbackSessionId: createUuid(),
    contentId: video?.id ?? '',
    surface: getSurface(source),
    durationMs: Math.max(0, Math.round(duration * 1000)),
    watchedMs: 0,
    loopCount: 0,
    started: false,
  };
}

export function useVideoMetricsTracker({
  video,
  isPlaying,
  currentTime,
  duration,
  source = 'unknown',
  enabled = true,
  visibilityRatio = 0,
  position = 0,
}: UseVideoMetricsTrackerOptions) {
  const { publishViewEvent, isAuthenticated } = useViewEventPublisher();
  const publishViewEventRef = useRef(publishViewEvent);
  const sourceRef = useRef(source);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const enabledRef = useRef(enabled);
  const isPlayingRef = useRef(isPlaying);
  const durationRef = useRef(duration);
  const positionRef = useRef(position);

  publishViewEventRef.current = publishViewEvent;
  sourceRef.current = source;
  isAuthenticatedRef.current = isAuthenticated;
  enabledRef.current = enabled;
  isPlayingRef.current = isPlaying;
  durationRef.current = duration;
  positionRef.current = position;

  const metricsRef = useRef<VideoMetricsState>({
    lastPosition: 0,
    loopCount: 0,
    hasTrackedView: false,
  });
  const currentVideoIdRef = useRef<string | null>(null);
  const trackedVideoRef = useRef<ParsedVideoData | null>(video);
  const watchTimeAccumulatorRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());
  const productPlaybackRef = useRef(newProductPlayback(video, source, duration));
  const impressionVideoIdRef = useRef<string | null>(null);
  const impressionRecordedRef = useRef(false);
  const impressionTimerRef = useRef<number>();

  const flushWatchTime = useCallback((countPlayback = isPlayingRef.current) => {
    const now = Date.now();
    const elapsedMs = now - lastUpdateTimeRef.current;
    if (countPlayback && elapsedMs > 0 && elapsedMs < 10_000) {
      watchTimeAccumulatorRef.current += elapsedMs / 1000;
      if (productPlaybackRef.current.started) {
        productPlaybackRef.current.watchedMs += elapsedMs;
      }
    }
    lastUpdateTimeRef.current = now;
  }, []);

  const publishAndReset = useCallback(async (targetVideo = trackedVideoRef.current) => {
    if (!targetVideo || !enabledRef.current || !isAuthenticatedRef.current) return;

    const rawWatchedSeconds = watchTimeAccumulatorRef.current;
    if (rawWatchedSeconds <= 0) return;

    const watchedSeconds = Math.floor(rawWatchedSeconds);
    watchTimeAccumulatorRef.current = 0;
    lastUpdateTimeRef.current = Date.now();
    await publishViewEventRef.current({
      video: targetVideo,
      startSeconds: 0,
      endSeconds: watchedSeconds,
      source: sourceRef.current,
    }).catch((error) => {
      debugLog('[VideoMetricsTracker] Failed to publish view event:', error);
    });
  }, []);

  const recordProductPlayback = useCallback((endReason: 'navigation' | 'backgrounded') => {
    const playback = productPlaybackRef.current;
    if (!enabledRef.current || !playback.started || playback.watchedMs <= 0 || !playback.contentId) return;

    void trackProductEvent('playback_session_recorded', {
      playback_session_id: playback.playbackSessionId,
      content_id: playback.contentId,
      surface: playback.surface,
      duration_ms: playback.durationMs,
      watched_ms: Math.round(playback.watchedMs),
      loop_count: playback.loopCount,
      completed: playback.loopCount > 0 || (
        playback.durationMs > 0 && playback.watchedMs >= playback.durationMs
      ),
      end_reason: endReason,
    });
    productPlaybackRef.current = newProductPlayback(
      trackedVideoRef.current,
      sourceRef.current,
      durationRef.current,
    );
  }, []);

  useEffect(() => {
    const videoId = video?.id ?? null;
    if (!videoId) return;

    if (currentVideoIdRef.current !== videoId) {
      if (currentVideoIdRef.current) {
        const previousVideo = trackedVideoRef.current;
        flushWatchTime();
        void publishAndReset(previousVideo);
        recordProductPlayback('navigation');
      }

      metricsRef.current = { lastPosition: 0, loopCount: 0, hasTrackedView: false };
      watchTimeAccumulatorRef.current = 0;
      lastUpdateTimeRef.current = Date.now();
      currentVideoIdRef.current = videoId;
      productPlaybackRef.current = newProductPlayback(video, source, duration);
      impressionVideoIdRef.current = videoId;
      impressionRecordedRef.current = false;
      if (impressionTimerRef.current !== undefined) {
        window.clearTimeout(impressionTimerRef.current);
        impressionTimerRef.current = undefined;
      }
    } else {
      productPlaybackRef.current.surface = getSurface(source);
      productPlaybackRef.current.durationMs = Math.max(0, Math.round(duration * 1000));
    }
    trackedVideoRef.current = video;
  }, [duration, flushWatchTime, publishAndReset, recordProductPlayback, source, video, video?.id]);

  useEffect(() => {
    if (!video?.id || !enabled || !isPlaying) return;

    metricsRef.current.hasTrackedView = true;
    productPlaybackRef.current.started = true;
    lastUpdateTimeRef.current = Date.now();
    const interval = window.setInterval(() => {
      flushWatchTime(true);
    }, 1000);

    return () => {
      flushWatchTime(true);
      window.clearInterval(interval);
    };
  }, [enabled, flushWatchTime, isPlaying, video?.id]);

  useEffect(() => {
    if (!video?.id || !enabled || duration <= 0) return;

    const metrics = metricsRef.current;
    if (metrics.lastPosition > 0 && currentTime < 1 && metrics.lastPosition >= duration - 1) {
      metrics.loopCount += 1;
      productPlaybackRef.current.loopCount += 1;
      flushWatchTime();
      void publishAndReset();
    }
    metrics.lastPosition = currentTime;
  }, [currentTime, duration, enabled, flushWatchTime, publishAndReset, video?.id]);

  useEffect(() => {
    if (!video?.id || !enabled || impressionRecordedRef.current) return;

    if (visibilityRatio < 0.5) {
      if (impressionTimerRef.current !== undefined) {
        window.clearTimeout(impressionTimerRef.current);
        impressionTimerRef.current = undefined;
      }
      return;
    }
    if (impressionTimerRef.current !== undefined) return;

    const contentId = video.id;
    impressionTimerRef.current = window.setTimeout(() => {
      impressionTimerRef.current = undefined;
      if (impressionVideoIdRef.current !== contentId || impressionRecordedRef.current) return;
      impressionRecordedRef.current = true;
      void trackProductEvent('content_impression_recorded', {
        content_id: contentId,
        surface: getSurface(sourceRef.current),
        position: Math.max(0, Math.floor(positionRef.current)),
        visible_ms: 1000,
      });
    }, 1000);

  }, [enabled, video?.id, visibilityRatio]);

  useEffect(() => () => {
    if (impressionTimerRef.current !== undefined) {
      window.clearTimeout(impressionTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushWatchTime();
        void publishAndReset();
        recordProductPlayback('backgrounded');
        return;
      }
      lastUpdateTimeRef.current = Date.now();
      if (isPlayingRef.current) productPlaybackRef.current.started = true;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [flushWatchTime, publishAndReset, recordProductPlayback]);

  useEffect(() => {
    return () => {
      flushWatchTime();
      void publishAndReset();
      recordProductPlayback('navigation');
    };
  }, [flushWatchTime, publishAndReset, recordProductPlayback]);

  return {
    watchedSeconds: Math.floor(watchTimeAccumulatorRef.current),
    loopCount: metricsRef.current.loopCount,
    isTracking: metricsRef.current.hasTrackedView,
  };
}
