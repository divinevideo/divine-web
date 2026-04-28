// ABOUTME: Builds optimized HLS.js configurations based on bandwidth tier
// ABOUTME: Tiered buffer sizes for low/medium/high bandwidth users

import type Hls from 'hls.js';
import type { BandwidthTier } from './bandwidthTracker';
import { createAuthLoader } from './hlsAuthLoader';

interface HlsConfigOptions {
  tier: BandwidthTier;
  isAdultVerified: boolean;
  getAuthHeader: (url: string, method: string, sha256?: string) => Promise<string | null>;
}

const TIER_CONFIGS = {
  low: {
    enableWorker: true,
    lowLatencyMode: false,
    backBufferLength: 30,
    maxBufferLength: 15,
    maxMaxBufferLength: 30,
    startLevel: -1,
    capLevelToPlayerSize: true,
  },
  medium: {
    enableWorker: true,
    lowLatencyMode: false,
    backBufferLength: 60,
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    startLevel: -1,
    capLevelToPlayerSize: true,
  },
  high: {
    enableWorker: true,
    lowLatencyMode: false,
    backBufferLength: 90,
    maxBufferLength: 30,
    maxMaxBufferLength: 120,
    startLevel: -1,
    capLevelToPlayerSize: true,
  },
};

export function buildHlsConfig(options: HlsConfigOptions): Partial<Hls['config']> {
  const { tier, isAdultVerified, getAuthHeader } = options;

  const baseConfig = TIER_CONFIGS[tier];

  const hlsConfig: Partial<Hls['config']> = {
    ...baseConfig,
  };

  if (isAdultVerified) {
    hlsConfig.loader = createAuthLoader(getAuthHeader);
  }

  return hlsConfig;
}

export function getPreloadAttribute(tier: BandwidthTier, isPriority: boolean, hasLoadedOnce: boolean): 'none' | 'metadata' | 'auto' {
  if (isPriority || hasLoadedOnce) {
    return 'auto';
  }

  switch (tier) {
    case 'low':
      return 'metadata';
    case 'medium':
      return 'metadata';
    case 'high':
      return 'auto';
  }
}
