// ABOUTME: Tracks video load performance to estimate user bandwidth
// ABOUTME: Uses historical load times to select optimal video quality (480p/720p/original)

import { debugLog } from './debug';

export type BandwidthTier = 'low' | 'medium' | 'high';

interface LoadSample {
  bytesLoaded: number;
  loadTimeMs: number;
  timestamp: number;
}

// Bandwidth thresholds in Mbps
const BANDWIDTH_THRESHOLDS = {
  low: 2,      // Below 2 Mbps -> use 480p
  medium: 5,   // 2-5 Mbps -> use HLS adaptive (master.m3u8)
  high: 10,    // Above 5 Mbps -> could use original, but HLS is fine
};

// How many samples to keep for rolling average
const MAX_SAMPLES = 10;

// How old samples can be before they're discarded (5 minutes)
const SAMPLE_MAX_AGE_MS = 5 * 60 * 1000;

class BandwidthTracker {
  private samples: LoadSample[] = [];
  private currentTier: BandwidthTier = 'medium'; // Start with adaptive
  private listeners: Set<(tier: BandwidthTier) => void> = new Set();

  /**
   * Record a video load event
   * @param bytesLoaded - Size of video in bytes (estimate if unknown)
   * @param loadTimeMs - Time to load/buffer in milliseconds
   */
  recordLoad(bytesLoaded: number, loadTimeMs: number): void {
    // Ignore very fast loads (likely cached) or very slow (likely stalled)
    if (loadTimeMs < 50 || loadTimeMs > 30000) {
      return;
    }

    // Ignore tiny loads (likely just manifest)
    if (bytesLoaded < 10000) {
      return;
    }

    const sample: LoadSample = {
      bytesLoaded,
      loadTimeMs,
      timestamp: Date.now(),
    };

    this.samples.push(sample);

    // Prune old samples
    this.pruneOldSamples();

    // Keep only recent samples
    if (this.samples.length > MAX_SAMPLES) {
      this.samples = this.samples.slice(-MAX_SAMPLES);
    }

    // Recalculate tier
    this.updateTier();
  }

  /**
   * Record a load using Resource Timing API data
   */
  recordFromPerformance(entry: PerformanceResourceTiming): void {
    const loadTimeMs = entry.responseEnd - entry.requestStart;
    const bytesLoaded = entry.transferSize || entry.encodedBodySize || 0;

    if (bytesLoaded > 0 && loadTimeMs > 0) {
      this.recordLoad(bytesLoaded, loadTimeMs);
    }
  }

  private pruneOldSamples(): void {
    const cutoff = Date.now() - SAMPLE_MAX_AGE_MS;
    this.samples = this.samples.filter(s => s.timestamp > cutoff);
  }

  private updateTier(): void {
    if (this.samples.length < 2) {
      // Not enough data yet, stay at medium
      return;
    }

    const bandwidth = this.calculateBandwidthMbps();
    let newTier: BandwidthTier;

    if (bandwidth < BANDWIDTH_THRESHOLDS.low) {
      newTier = 'low';
    } else if (bandwidth < BANDWIDTH_THRESHOLDS.medium) {
      newTier = 'medium';
    } else {
      newTier = 'high';
    }

    if (newTier !== this.currentTier) {
      debugLog(`[BandwidthTracker] Tier changed: ${this.currentTier} -> ${newTier} (${bandwidth.toFixed(2)} Mbps)`);
      this.currentTier = newTier;
      this.notifyListeners();
    }
  }

  /**
   * Calculate estimated bandwidth in Mbps from samples
   */
  private calculateBandwidthMbps(): number {
    if (this.samples.length === 0) {
      return BANDWIDTH_THRESHOLDS.medium; // Default assumption
    }

    // Calculate weighted average (more recent samples weighted higher)
    let totalWeightedBandwidth = 0;
    let totalWeight = 0;

    this.samples.forEach((sample, index) => {
      const weight = index + 1; // More recent = higher weight
      const bandwidthBps = (sample.bytesLoaded * 8) / (sample.loadTimeMs / 1000);
      const bandwidthMbps = bandwidthBps / 1_000_000;

      totalWeightedBandwidth += bandwidthMbps * weight;
      totalWeight += weight;
    });

    return totalWeightedBandwidth / totalWeight;
  }

  /**
   * Get current bandwidth tier
   */
  getTier(): BandwidthTier {
    return this.currentTier;
  }

  /**
   * Get estimated bandwidth in Mbps
   */
  getBandwidthMbps(): number {
    return this.calculateBandwidthMbps();
  }

  /**
   * Subscribe to tier changes
   */
  subscribe(callback: (tier: BandwidthTier) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb(this.currentTier));
  }

  /**
   * Force a specific tier (for testing or user preference)
   */
  setTier(tier: BandwidthTier): void {
    if (tier !== this.currentTier) {
      debugLog(`[BandwidthTracker] Tier manually set: ${tier}`);
      this.currentTier = tier;
      this.notifyListeners();
    }
  }

  /**
   * Get sample count (for debugging)
   */
  getSampleCount(): number {
    return this.samples.length;
  }
}

// Singleton instance
export const bandwidthTracker = new BandwidthTracker();

/**
 * Get the optimal video URL based on current bandwidth tier
 *
 * @param videoUrl - Original video URL (e.g., https://media.divine.video/{hash})
 * @param forceQuality - Optional: force a specific quality
 * @returns Optimal URL for current bandwidth
 */
export function getOptimalVideoUrl(
  videoUrl: string,
  forceQuality?: '480p' | '720p' | 'adaptive' | 'original'
): string {
  // Only apply to media.divine.video URLs
  if (!videoUrl.includes('media.divine.video/')) {
    return videoUrl;
  }

  // Don't modify if already an HLS URL
  if (videoUrl.includes('/hls/')) {
    return videoUrl;
  }

  // Extract hash from URL
  const match = videoUrl.match(/media\.divine\.video\/([a-f0-9]+)/i);
  if (!match) {
    return videoUrl;
  }

  const hash = match[1];
  const baseUrl = `https://media.divine.video/${hash}`;

  // If forcing a specific quality
  if (forceQuality) {
    switch (forceQuality) {
      case '480p':
        return `${baseUrl}/hls/stream_480p.m3u8`;
      case '720p':
        return `${baseUrl}/hls/stream_720p.m3u8`;
      case 'adaptive':
        return `${baseUrl}/hls/master.m3u8`;
      case 'original':
        return videoUrl;
    }
  }

  // Choose based on current bandwidth tier
  const tier = bandwidthTracker.getTier();

  switch (tier) {
    case 'low':
      // Force 480p for slow connections
      return `${baseUrl}/hls/stream_480p.m3u8`;
    case 'medium':
      // Use adaptive streaming
      return `${baseUrl}/hls/master.m3u8`;
    case 'high':
      // For now, still use adaptive - could use original for very high bandwidth
      return `${baseUrl}/hls/master.m3u8`;
  }
}

/**
 * Check if HLS is available for a video (returns true if HLS URL responds with 200)
 */
export async function checkHlsAvailable(videoUrl: string): Promise<boolean> {
  const hlsUrl = getOptimalVideoUrl(videoUrl, 'adaptive');

  if (hlsUrl === videoUrl) {
    return false; // Not a media.divine.video URL
  }

  try {
    const response = await fetch(hlsUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Hook to observe video element load performance
 * Call this after video loads to record bandwidth sample
 */
export function recordVideoLoad(video: HTMLVideoElement, estimatedBytes?: number): void {
  // Try to get actual timing from Performance API
  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const videoEntry = entries.find(e =>
    e.name.includes(video.currentSrc) ||
    video.currentSrc.includes(e.name.split('/').pop() || '')
  );

  if (videoEntry && videoEntry.transferSize > 0) {
    bandwidthTracker.recordFromPerformance(videoEntry);
    return;
  }

  // Fallback: estimate based on duration and typical bitrates
  // 720p ~2-3 Mbps, 480p ~1-1.5 Mbps, assume 6 second video
  if (!estimatedBytes && video.duration) {
    // Estimate: 720p = 2.5 Mbps = 312.5 KB/s
    // For 6 seconds: ~1.875 MB = 1,875,000 bytes
    estimatedBytes = Math.round(video.duration * 312500);
  }

  // If we have timeupdate or canplaythrough timing, use that
  // This is a rough estimate since we can't easily measure exact load time
  // The Performance API approach above is more accurate
}
