// ABOUTME: Verifies VideoPlayer surfaces a terminal "unavailable" state on 404/410 preflight
// ABOUTME: and signals the parent via onError so feeds/pages can skip or show a message.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const checkMediaAuth = vi.fn();
const getAuthHeader = vi.fn();

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
    isVerified: false,
    isLoading: false,
    hasSigner: false,
    confirmAdult: vi.fn(),
    revokeVerification: vi.fn(),
    getAuthHeader,
  })),
  checkMediaAuth: (...args: unknown[]) => checkMediaAuth(...args),
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
  debugLog: vi.fn(),
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
  useInView: vi.fn(() => ({ ref: vi.fn(), inView: true, entry: null })),
}));

import { VideoPlayer } from './VideoPlayer';

const URL_MP4 = 'https://media.divine.video/gone-file.mp4';

describe('VideoPlayer — terminal unavailable (404/410)', () => {
  beforeEach(() => {
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();
    checkMediaAuth.mockReset();
    getAuthHeader.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an unavailable placeholder and calls onError when preflight returns 404', async () => {
    checkMediaAuth.mockResolvedValue({ authorized: false, status: 404 });
    const onError = vi.fn();

    render(<VideoPlayer videoId="v-404" src={URL_MP4} onError={onError} />);

    await waitFor(() => {
      expect(screen.getByText(/video unavailable/i)).toBeInTheDocument();
    });
    expect(onError).toHaveBeenCalled();
  });

  it('shows an unavailable placeholder when preflight returns 410', async () => {
    checkMediaAuth.mockResolvedValue({ authorized: false, status: 410 });
    const onError = vi.fn();

    render(<VideoPlayer videoId="v-410" src={URL_MP4} onError={onError} />);

    await waitFor(() => {
      expect(screen.getByText(/video unavailable/i)).toBeInTheDocument();
    });
    expect(onError).toHaveBeenCalled();
  });

  it('does not surface unavailable on a successful preflight (200)', async () => {
    checkMediaAuth.mockResolvedValue({ authorized: true, status: 200 });
    const onError = vi.fn();

    render(<VideoPlayer videoId="v-ok" src={URL_MP4} onError={onError} />);

    // Give the effect a tick to run
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText(/video unavailable/i)).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not surface unavailable on a 401 (that path shows the age-gate overlay instead)', async () => {
    checkMediaAuth.mockResolvedValue({ authorized: false, status: 401 });
    const onError = vi.fn();

    render(<VideoPlayer videoId="v-401" src={URL_MP4} onError={onError} />);

    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText(/video unavailable/i)).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('preflights the direct MP4 — not HLS — so a missing HLS manifest does not mark the video unavailable', async () => {
    // Most real-world case: classic Vine has a fine MP4 but no HLS transcode yet.
    // checkMediaAuth will be called with the MP4 URL and return 200.
    // Fail the test if the HLS URL is ever passed to checkMediaAuth.
    checkMediaAuth.mockImplementation(async (url: string) => {
      if (url.includes('/hls/master.m3u8')) {
        throw new Error('preflight should not hit HLS manifest: ' + url);
      }
      return { authorized: true, status: 200 };
    });
    const onError = vi.fn();

    render(
      <VideoPlayer
        videoId="v-hls-404-but-mp4-ok"
        src={URL_MP4}
        hlsUrl="https://media.divine.video/foo/hls/master.m3u8"
        onError={onError}
      />,
    );

    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText(/video unavailable/i)).toBeNull();
    expect(onError).not.toHaveBeenCalled();
    // And we should actually have preflighted the MP4
    expect(checkMediaAuth).toHaveBeenCalledWith(URL_MP4);
  });
});
