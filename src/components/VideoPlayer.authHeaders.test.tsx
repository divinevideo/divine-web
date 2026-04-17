// ABOUTME: Tests that VideoPlayer forwards videoData.sha256 into getAuthHeader for MP4 fetches
// ABOUTME: Verifies Blossom auth hint flows through for age-gated direct playback; absent when unknown

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const getAuthHeader = vi.fn().mockResolvedValue('Nostr HEADER');

// Mock dependencies — mirror sibling VideoPlayer.test.tsx style
vi.mock('@/hooks/useVideoPlayback', () => ({
  useVideoPlayback: vi.fn(() => ({
    activeVideoId: null,
    registerVideo: vi.fn(),
    unregisterVideo: vi.fn(),
    updateVideoVisibility: vi.fn(),
    globalMuted: true,
  })),
}));

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

vi.mock('@/hooks/useAdultVerification', () => ({
  useAdultVerification: vi.fn(() => ({
    isVerified: true,
    isLoading: false,
    hasSigner: true,
    confirmAdult: vi.fn(),
    revokeVerification: vi.fn(),
    getAuthHeader,
  })),
  checkMediaAuth: vi.fn().mockResolvedValue({ authorized: true, status: 200 }),
  fetchWithAuth: vi.fn(),
}));

vi.mock('@/hooks/useVideoMetricsTracker', () => ({
  useVideoMetricsTracker: vi.fn(() => ({
    watchedSeconds: 0,
    loopCount: 0,
    isTracking: false,
  })),
}));

vi.mock('@/lib/debug', () => ({
  debugError: vi.fn(),
  verboseLog: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackFirstVideoPlayback: vi.fn(),
}));

vi.mock('hls.js', () => ({
  default: {
    isSupported: () => false,
    Events: { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' },
  },
}));

vi.mock('react-intersection-observer', () => ({
  useInView: vi.fn(() => ({
    ref: vi.fn(),
    inView: true,
    entry: null,
  })),
}));

import { VideoPlayer } from './VideoPlayer';
import { SHORT_VIDEO_KIND } from '@/types/video';

const HASH = 'a'.repeat(64);
const URL_MP4 = 'https://media.divine.video/file.mp4';

describe('VideoPlayer auth headers', () => {
  beforeEach(() => {
    // Stub HTMLMediaElement methods
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();

    // Stub URL.createObjectURL / revokeObjectURL for jsdom if missing
    if (!global.URL.createObjectURL) {
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:stub');
    }
    if (!global.URL.revokeObjectURL) {
      global.URL.revokeObjectURL = vi.fn();
    }

    // Stub fetch so the MP4 path completes deterministically
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob(['x'], { type: 'video/mp4' })),
    }) as unknown as typeof fetch;

    getAuthHeader.mockClear();
    getAuthHeader.mockResolvedValue('Nostr HEADER');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes sha256 into getAuthHeader for direct MP4 fetch when videoData.sha256 is set', async () => {
    render(
      <VideoPlayer
        videoId="v1"
        src={URL_MP4}
        videoData={{
          id: 'v1',
          pubkey: 'pub',
          kind: SHORT_VIDEO_KIND,
          createdAt: 0,
          content: '',
          videoUrl: URL_MP4,
          sha256: HASH,
          hashtags: [],
          vineId: null,
          reposts: [],
          isVineMigrated: false,
        }}
      />,
    );

    await waitFor(() => expect(getAuthHeader).toHaveBeenCalled());
    const [url, method, sha256] = getAuthHeader.mock.calls[0];
    expect(url).toBe(URL_MP4);
    expect(method ?? 'GET').toBe('GET');
    expect(sha256).toBe(HASH);
  });

  it('omits the sha256 hint when videoData.sha256 is absent', async () => {
    render(
      <VideoPlayer
        videoId="v2"
        src={URL_MP4}
        videoData={{
          id: 'v2',
          pubkey: 'pub',
          kind: SHORT_VIDEO_KIND,
          createdAt: 0,
          content: '',
          videoUrl: URL_MP4,
          hashtags: [],
          vineId: null,
          reposts: [],
          isVineMigrated: false,
        }}
      />,
    );

    await waitFor(() => expect(getAuthHeader).toHaveBeenCalled());
    const [, , sha256] = getAuthHeader.mock.calls[0];
    expect(sha256).toBeUndefined();
  });
});
