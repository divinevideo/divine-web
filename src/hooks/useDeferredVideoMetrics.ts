// ABOUTME: Deferred video metrics loading to improve perceived performance
// ABOUTME: Delays non-essential queries until after initial render

import { useEffect, useState } from 'react';
import { useVideoSocialMetrics, useVideoUserInteractions } from './useVideoSocialMetrics';

interface UseDeferredVideoMetricsOptions {
  videoId: string;
  videoPubkey: string;
  vineId: string | null;
  userPubkey?: string;
  enabled?: boolean;
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
  enabled = true,
  delay = 100,
  immediate = false,
}: UseDeferredVideoMetricsOptions) {
  const [shouldLoad, setShouldLoad] = useState(immediate);

  // Enable loading after delay
  useEffect(() => {
    if (immediate || !enabled) return;

    const timer = setTimeout(() => {
      setShouldLoad(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, enabled, immediate]);

  // Only fetch when enabled
  const socialMetrics = useVideoSocialMetrics(videoId, videoPubkey, vineId, {
    enabled: enabled && shouldLoad,
  });

  const userInteractions = useVideoUserInteractions(
    videoId,
    videoPubkey,
    vineId,
    userPubkey,
    {
      enabled: enabled && shouldLoad && !!userPubkey,
    }
  );

  return {
    socialMetrics,
    userInteractions,
    isLoading: enabled && !shouldLoad,
  };
}
