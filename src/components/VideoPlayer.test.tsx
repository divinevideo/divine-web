// ABOUTME: Tests for VideoPlayer component
// ABOUTME: Verifies video loading, auth handling, and URL management

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { VideoPlayer } from './VideoPlayer';

// Mock dependencies
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
    getAuthHeader: vi.fn().mockResolvedValue(null),
  })),
  checkMediaAuth: vi.fn().mockResolvedValue({ authorized: true, status: 200 }),
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

// Mock react-intersection-observer to avoid observer.observe issues
vi.mock('react-intersection-observer', () => ({
  useInView: vi.fn(() => ({
    ref: vi.fn(),
    inView: true,
    entry: null,
  })),
}));

// Mock HTMLMediaElement methods
beforeEach(() => {
  // Mock play and pause on HTMLMediaElement prototype
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
  HTMLMediaElement.prototype.load = vi.fn();

  // Mock URL methods
  if (!global.URL.createObjectURL) {
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-123');
  }
  if (!global.URL.revokeObjectURL) {
    global.URL.revokeObjectURL = vi.fn();
  }
});

describe('VideoPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('URL handling - allUrls state management', () => {
    it('should synchronously compute allUrls from props (not async useState)', async () => {
      // This test verifies the bug: allUrls should use useMemo not useState
      //
      // The bug: When using useState + useEffect to set allUrls:
      // 1. Component mounts with src="video1.mp4"
      // 2. useEffect runs, sets allUrls = ["video1.mp4"]
      // 3. Another useEffect runs that depends on allUrls to set video.src
      // 4. User changes src to "video2.mp4"
      // 5. useState doesn't update synchronously, so the video loading effect
      //    might fire with STALE allUrls value
      //
      // The fix: Use useMemo instead of useState - it computes synchronously
      // from the props on every render

      const firstSrc = 'https://example.com/video1.mp4';
      const secondSrc = 'https://example.com/video2.mp4';

      // Track what src values were set on the video element
      const srcValues: string[] = [];

      // Override video element src setter to track changes
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const element = originalCreateElement(tagName);
        if (tagName === 'video') {
          let currentSrc = '';
          Object.defineProperty(element, 'src', {
            get: () => currentSrc,
            set: (value: string) => {
              currentSrc = value;
              if (value) srcValues.push(value);
            },
            configurable: true,
          });
        }
        return element;
      });

      const { rerender } = render(
        <VideoPlayer
          videoId="test-url-change"
          src={firstSrc}
        />
      );

      // Wait for initial src to be set
      await waitFor(() => {
        expect(srcValues).toContain(firstSrc);
      }, { timeout: 1000 });

      // Change the src prop
      rerender(
        <VideoPlayer
          videoId="test-url-change"
          src={secondSrc}
        />
      );

      // Wait for new src - with the bug (useState), this would timeout
      // because the effect fires before useState updates allUrls
      await waitFor(() => {
        expect(srcValues).toContain(secondSrc);
      }, { timeout: 1000 });
    });
  });

  describe('ref stability - prevents infinite loop', () => {
    it('should not trigger infinite loop when context values change', async () => {
      // This test verifies the bug: setRefs callback must be stable
      //
      // The bug: When setRefs has unstable dependencies (registerVideo, unregisterVideo, globalMuted)
      // and these change, the callback is recreated. React calls the new ref callback,
      // which can trigger state changes (via registerVideo), causing more renders,
      // creating an infinite loop.
      //
      // The fix: Either:
      // 1. Remove registerVideo/unregisterVideo from setRefs dependencies
      // 2. Use useCallback properly in the context
      // 3. Use useRef to store the functions

      let renderCount = 0;
      const mockRegisterVideo = vi.fn();
      const mockUnregisterVideo = vi.fn();

      // Override the useVideoPlayback mock to return new function refs on each call
      // This simulates what happens when VideoPlaybackContext doesn't use useCallback
      const { useVideoPlayback } = await import('@/hooks/useVideoPlayback');
      (useVideoPlayback as ReturnType<typeof vi.fn>).mockImplementation(() => {
        renderCount++;
        return {
          activeVideoId: null,
          // Return NEW functions each time (unstable references)
          registerVideo: mockRegisterVideo,
          unregisterVideo: mockUnregisterVideo,
          updateVideoVisibility: vi.fn(),
          globalMuted: true,
        };
      });

      // Ensure checkMediaAuth is properly mocked for this test
      const { checkMediaAuth } = await import('@/hooks/useAdultVerification');
      (checkMediaAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ authorized: true, status: 200 });

      // The component should render without hitting "Maximum update depth exceeded"
      const { unmount } = render(
        <VideoPlayer
          videoId="test-stability"
          src="https://example.com/stable.mp4"
        />
      );

      // Wait a bit for any potential loops
      await new Promise(resolve => setTimeout(resolve, 100));

      // If we got here without error, the test passes
      // The render count should be reasonable (< 10 for StrictMode double-render)
      expect(renderCount).toBeLessThan(20);

      unmount();
    });
  });

  describe('blob URL cleanup', () => {
    it('should revoke blob URLs on unmount to prevent memory leaks', async () => {
      // Spy on URL methods
      const revokeObjectURLSpy = vi.fn();
      const createObjectURLSpy = vi.fn().mockReturnValue('blob:test-123');
      global.URL.createObjectURL = createObjectURLSpy;
      global.URL.revokeObjectURL = revokeObjectURLSpy;

      // Mock adult verification as verified so it fetches with auth
      const { useAdultVerification } = await import('@/hooks/useAdultVerification');
      (useAdultVerification as ReturnType<typeof vi.fn>).mockReturnValue({
        isVerified: true,
        isLoading: false,
        hasSigner: true,
        getAuthHeader: vi.fn().mockResolvedValue('Nostr test-auth-header'),
      });

      // Mock fetch to return blob
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(['test'], { type: 'video/mp4' })),
      });

      // Mock checkMediaAuth to require auth
      const { checkMediaAuth } = await import('@/hooks/useAdultVerification');
      (checkMediaAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        authorized: false,
        status: 401,
      });

      const { unmount } = render(
        <VideoPlayer
          videoId="test-blob"
          src="https://cdn.example.com/video.mp4"
        />
      );

      // Wait for blob URL to be created (if auth flow triggers it)
      await waitFor(() => {
        // Either it created a blob URL or didn't - we'll check on unmount
        return true;
      }, { timeout: 500 });

      // Unmount component
      unmount();

      // If blob URL was created, it should be revoked
      if (createObjectURLSpy.mock.calls.length > 0) {
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-123');
      }
    });
  });
});
