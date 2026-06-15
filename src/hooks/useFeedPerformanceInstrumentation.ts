// ABOUTME: Feed-scoped performance instrumentation for render and first-playback metrics
// ABOUTME: Captures browser resource counts, media transfer, and mounted video counts per feed

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { incrementMetric, startTrace, trackEvent } from '@/lib/analytics';
import { performanceMonitor } from '@/lib/performanceMonitoring';

interface FeedPerformanceInstrumentationOptions {
  feedType: string;
  dataSource: 'funnelcake' | 'websocket';
  sortMode?: string;
  verifiedOnly?: boolean;
}

interface FeedMetricContext {
  renderedVideos: number;
  totalVideos: number;
  videoId?: string;
}

interface ResourceSummary {
  mediaRequestCount: number;
  mediaTransferBytes: number;
  videoRequestCount: number;
  imageRequestCount: number;
}

type FirebaseTraceHandle = ReturnType<typeof startTrace>;

const MEDIA_RESOURCE_PATTERN = /\.(avif|gif|heic|jpeg|jpg|m3u8|m4s|mp4|mov|png|ts|webm|webp)(\?|#|$)/i;
const VIDEO_RESOURCE_PATTERN = /\.(m3u8|m4s|mp4|mov|ts|webm)(\?|#|$)/i;
const IMAGE_RESOURCE_PATTERN = /\.(avif|gif|heic|jpeg|jpg|png|webp)(\?|#|$)/i;

function createFeedSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getTransferSize(entry: PerformanceResourceTiming) {
  return entry.transferSize || entry.encodedBodySize || entry.decodedBodySize || 0;
}

function isMediaResourceEntry(entry: PerformanceResourceTiming) {
  return entry.initiatorType === 'video' ||
    entry.initiatorType === 'img' ||
    entry.initiatorType === 'image' ||
    MEDIA_RESOURCE_PATTERN.test(entry.name) ||
    entry.name.includes('/manifest/') ||
    entry.name.includes('/segment/');
}

function getResourceSummarySince(startTime: number, endTime: number): ResourceSummary {
  if (typeof window === 'undefined') {
    return {
      mediaRequestCount: 0,
      mediaTransferBytes: 0,
      videoRequestCount: 0,
      imageRequestCount: 0,
    };
  }

  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const relevantEntries = resources.filter((entry) => (
    entry.startTime >= startTime &&
    entry.startTime <= endTime &&
    isMediaResourceEntry(entry)
  ));

  let mediaTransferBytes = 0;
  let videoRequestCount = 0;
  let imageRequestCount = 0;

  for (const entry of relevantEntries) {
    mediaTransferBytes += getTransferSize(entry);

    if (entry.initiatorType === 'video' || VIDEO_RESOURCE_PATTERN.test(entry.name) || entry.name.includes('/manifest/')) {
      videoRequestCount += 1;
    } else if (entry.initiatorType === 'img' || entry.initiatorType === 'image' || IMAGE_RESOURCE_PATTERN.test(entry.name)) {
      imageRequestCount += 1;
    }
  }

  return {
    mediaRequestCount: relevantEntries.length,
    mediaTransferBytes,
    videoRequestCount,
    imageRequestCount,
  };
}

export function useFeedPerformanceInstrumentation({
  feedType,
  dataSource,
  sortMode,
  verifiedOnly = false,
}: FeedPerformanceInstrumentationOptions) {
  const location = useLocation();
  const feedRootRef = useRef<HTMLDivElement | null>(null);
  const mountStartRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0);
  const sessionIdRef = useRef<string>(createFeedSessionId());
  const initialRenderTrackedRef = useRef(false);
  const firstPlaybackTrackedRef = useRef(false);
  const initialRenderTraceRef = useRef<FirebaseTraceHandle>(null);
  const firstPlaybackTraceRef = useRef<FirebaseTraceHandle>(null);

  const stopTrace = useCallback((traceRef: MutableRefObject<FirebaseTraceHandle>, status: 'success' | 'abandoned') => {
    const trace = traceRef.current;
    if (!trace) return;

    try {
      trace.putAttribute('status', status);
      trace.stop();
    } catch {
      // Ignore trace shutdown failures - analytics event is the source of truth.
    } finally {
      traceRef.current = null;
    }
  }, []);

  const startFeedTrace = useCallback((traceName: string) => {
    const trace = startTrace(traceName);
    if (!trace) return null;

    try {
      trace.putAttribute('feed_type', feedType);
      trace.putAttribute('data_source', dataSource);
      trace.putAttribute('sort_mode', sortMode || 'default');
      trace.putAttribute('route_path', location.pathname.slice(0, 100));
      trace.putAttribute('verified_only', verifiedOnly ? '1' : '0');
    } catch {
      // Attribute failures should not block the trace itself.
    }

    return trace;
  }, [dataSource, feedType, location.pathname, sortMode, verifiedOnly]);

  useEffect(() => {
    stopTrace(initialRenderTraceRef, 'abandoned');
    stopTrace(firstPlaybackTraceRef, 'abandoned');
    mountStartRef.current = performance.now();
    sessionIdRef.current = createFeedSessionId();
    initialRenderTrackedRef.current = false;
    firstPlaybackTrackedRef.current = false;
    initialRenderTraceRef.current = startFeedTrace('feed_initial_render');
    firstPlaybackTraceRef.current = startFeedTrace('feed_first_playback');

    return () => {
      stopTrace(initialRenderTraceRef, 'abandoned');
      stopTrace(firstPlaybackTraceRef, 'abandoned');
    };
  }, [dataSource, feedType, location.key, sortMode, startFeedTrace, stopTrace, verifiedOnly]);

  const buildBaseMetadata = useCallback((context: FeedMetricContext, endTime: number) => {
    const root = feedRootRef.current;
    const feedVideoElements = root?.querySelectorAll('video').length ?? 0;
    const documentVideoElements = typeof document !== 'undefined' ? document.querySelectorAll('video').length : 0;
    const resources = getResourceSummarySince(mountStartRef.current, endTime);
    const elapsedMs = endTime - mountStartRef.current;

    return {
      feed_session_id: sessionIdRef.current,
      feed_type: feedType,
      data_source: dataSource,
      sort_mode: sortMode || 'default',
      route_path: location.pathname,
      verified_only: verifiedOnly ? 1 : 0,
      rendered_videos: context.renderedVideos,
      total_videos: context.totalVideos,
      feed_video_elements: feedVideoElements,
      document_video_elements: documentVideoElements,
      media_request_count: resources.mediaRequestCount,
      media_transfer_kb: Math.round(resources.mediaTransferBytes / 1024),
      video_request_count: resources.videoRequestCount,
      image_request_count: resources.imageRequestCount,
      elapsed_ms: Math.round(elapsedMs),
      ...(context.videoId ? { video_id: context.videoId } : {}),
    };
  }, [dataSource, feedType, location.pathname, sortMode, verifiedOnly]);

  const trackInitialRender = useCallback((context: FeedMetricContext) => {
    if (initialRenderTrackedRef.current || context.renderedVideos === 0) {
      return;
    }

    const endTime = performance.now();
    const elapsedMs = endTime - mountStartRef.current;
    const metadata = buildBaseMetadata(context, endTime);
    initialRenderTrackedRef.current = true;

    const trace = initialRenderTraceRef.current;
    if (trace) {
      incrementMetric(trace, 'elapsed_ms', metadata.elapsed_ms);
      incrementMetric(trace, 'rendered_videos', metadata.rendered_videos);
      incrementMetric(trace, 'total_videos', metadata.total_videos);
      incrementMetric(trace, 'feed_video_elements', metadata.feed_video_elements);
      incrementMetric(trace, 'media_request_count', metadata.media_request_count);
      incrementMetric(trace, 'media_transfer_kb', metadata.media_transfer_kb);
      stopTrace(initialRenderTraceRef, 'success');
    }

    performanceMonitor.recordMetric('feed_initial_render', elapsedMs, metadata);
    trackEvent('feed_initial_render', metadata);
  }, [buildBaseMetadata, stopTrace]);

  const trackFirstPlayback = useCallback((context: FeedMetricContext) => {
    if (firstPlaybackTrackedRef.current) {
      return;
    }

    if (!initialRenderTrackedRef.current) {
      trackInitialRender(context);
    }

    const endTime = performance.now();
    const elapsedMs = endTime - mountStartRef.current;
    const metadata = buildBaseMetadata(context, endTime);
    firstPlaybackTrackedRef.current = true;

    const trace = firstPlaybackTraceRef.current;
    if (trace) {
      incrementMetric(trace, 'elapsed_ms', metadata.elapsed_ms);
      incrementMetric(trace, 'rendered_videos', metadata.rendered_videos);
      incrementMetric(trace, 'total_videos', metadata.total_videos);
      incrementMetric(trace, 'feed_video_elements', metadata.feed_video_elements);
      incrementMetric(trace, 'media_request_count', metadata.media_request_count);
      incrementMetric(trace, 'media_transfer_kb', metadata.media_transfer_kb);
      incrementMetric(trace, 'video_request_count', metadata.video_request_count);
      incrementMetric(trace, 'image_request_count', metadata.image_request_count);
      stopTrace(firstPlaybackTraceRef, 'success');
    }

    performanceMonitor.recordMetric('feed_first_playback', elapsedMs, metadata);
    trackEvent('feed_first_playback', metadata);
  }, [buildBaseMetadata, stopTrace, trackInitialRender]);

  return {
    feedRootRef,
    trackInitialRender,
    trackFirstPlayback,
  };
}
