// ABOUTME: React hook for accessing bandwidth tier state
// ABOUTME: Re-renders components when bandwidth tier changes

import { useState, useEffect, useSyncExternalStore } from 'react';
import { bandwidthTracker, type BandwidthTier } from '@/lib/bandwidthTracker';

/**
 * Hook to get current bandwidth tier with automatic re-render on changes
 */
export function useBandwidthTier(): BandwidthTier {
  return useSyncExternalStore(
    (callback) => bandwidthTracker.subscribe(callback),
    () => bandwidthTracker.getTier(),
    () => 'medium' // Server-side default
  );
}

/**
 * Hook to get bandwidth info including estimated Mbps
 */
export function useBandwidthInfo(): {
  tier: BandwidthTier;
  mbps: number;
  sampleCount: number;
} {
  const [info, setInfo] = useState({
    tier: bandwidthTracker.getTier(),
    mbps: bandwidthTracker.getBandwidthMbps(),
    sampleCount: bandwidthTracker.getSampleCount(),
  });

  useEffect(() => {
    const update = () => {
      setInfo({
        tier: bandwidthTracker.getTier(),
        mbps: bandwidthTracker.getBandwidthMbps(),
        sampleCount: bandwidthTracker.getSampleCount(),
      });
    };

    return bandwidthTracker.subscribe(update);
  }, []);

  return info;
}
