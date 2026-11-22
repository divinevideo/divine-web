// ABOUTME: Deferred video metrics loading to improve perceived performance
// ABOUTME: Delays non-essential queries until after initial render

import { useEffect, useState } from 'react';
import { useVideoSocialMetrics, useVideoUserInteractions } from './useVideoSocialMetrics';

interface UseDeferredVideoMetricsOptions {
  videoId: string;
  videoPubkey: string;
  vineId: string | null;
  userPubkey?: string;
  /**
   * Delay in ms before loading metrics
   * @default 100
   */
  delay?: number;
  /**
   * Whether to load immediately (for videos in viewport)
   * @default false
   */
  immediate?: boolean;
  /**
   * Skip per-video GET /api/videos/{id}/stats when the feed payload already
   * includes Funnelcake view and loop counts.
   * @default false
   */
  skipStatsFetch?: boolean;
}

/**
 * Hook that defers loading of video social metrics and user interactions
 * to improve perceived performance on initial page load
 *
 * Videos render immediately with placeholders, then metrics load after a short delay
 */
export function useDeferredVideoMetrics({
  videoId,
  videoPubkey,
  vineId,
  userPubkey,
  delay = 100,
  immediate = false,
  skipStatsFetch = false,
}: UseDeferredVideoMetricsOptions) {
  const [shouldLoad, setShouldLoad] = useState(immediate);

  // Enable loading after delay
  useEffect(() => {
    if (immediate) return;

    const timer = setTimeout(() => {
      setShouldLoad(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, immediate]);

  // Only fetch when enabled
  const socialMetrics = useVideoSocialMetrics(videoId, videoPubkey, vineId, {
    enabled: shouldLoad && !skipStatsFetch,
  });

  const userInteractions = useVideoUserInteractions(
    videoId,
    videoPubkey,
    vineId,
    userPubkey,
    {
      enabled: shouldLoad && !!userPubkey,
    }
  );

  return {
    socialMetrics,
    userInteractions,
    isLoading: !shouldLoad,
  };
}
