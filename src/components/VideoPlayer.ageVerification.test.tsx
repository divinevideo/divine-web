import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VideoPlayer } from './VideoPlayer';
import { initializeI18n } from '@/lib/i18n';
import type { ParsedVideoData } from '@/types/video';

const { signer, registerVideo, unregisterVideo, updateVideoVisibility, playbackState } = vi.hoisted(() => ({
  signer: { signEvent: vi.fn() },
  registerVideo: vi.fn(), unregisterVideo: vi.fn(), updateVideoVisibility: vi.fn(),
  playbackState: { muted: true },
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: 'a'.repeat(64) }, signer }),
}));
vi.mock('@/hooks/useProtectedMinorStatus', () => ({
  useProtectedMinorStatus: () => ({ state: 'not_protected', isKnown: true, verifiedMinorAt: null }),
}));
vi.mock('@/lib/mediaViewerAuth', () => ({
  createMediaViewerAuthHeader: vi.fn().mockResolvedValue('Nostr test-viewer-auth'),
}));
vi.mock('@/hooks/useVideoPlayback', () => ({
  useVideoPlayback: () => ({
    activeVideoId: 'real-age', globalMuted: playbackState.muted, setUserPaused: vi.fn(),
    registerVideo, unregisterVideo, updateVideoVisibility,
  }),
}));
vi.mock('@/hooks/useVideoMetricsTracker', () => ({
  useVideoMetricsTracker: () => ({ watchedSeconds: 0, loopCount: 0, isTracking: false }),
}));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/contexts/LoginDialogContext', () => ({ useLoginDialog: () => ({ openLoginDialog: vi.fn() }) }));
vi.mock('react-intersection-observer', () => ({ useInView: () => ({ ref: vi.fn(), inView: true }) }));
vi.mock('hls.js', () => ({ default: { isSupported: () => false } }));

function stubDeferredFrames() {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  }));
  const cancelFrame = vi.fn((id: number) => { frames.delete(id); });
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  return { frames, cancelFrame };
}

describe('VideoPlayer with real adult verification', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  beforeEach(async () => {
    localStorage.clear();
    playbackState.muted = true;
    await initializeI18n({ force: true, languages: ['en-US'] });
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();
    URL.createObjectURL = vi.fn().mockReturnValue('blob:verified-video');
    URL.revokeObjectURL = vi.fn();
  });

  it('fetches protected media after confirmation updates both parent and overlay hooks', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, options?: RequestInit) => options?.method === 'HEAD'
      ? { ok: false, status: 401 }
      : { ok: true, status: 200, blob: async () => new Blob(['video']) });
    vi.stubGlobal('fetch', fetchMock);
    const video: ParsedVideoData = {
      id: 'real-age', pubkey: 'b'.repeat(64), kind: 34236, createdAt: 1,
      content: '', videoUrl: 'https://media.divine.video/restricted.mp4',
      ageRestricted: true, hashtags: [], reposts: [], vineId: 'real-age', isVineMigrated: false,
    };
    render(<VideoPlayer videoId={video.id} src={video.videoUrl} videoData={video} />);
    fireEvent.click(await screen.findByRole('button', { name: /18 or older/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(video.videoUrl, expect.objectContaining({
      headers: { Authorization: 'Nostr test-viewer-auth' },
    })));
    expect(screen.queryByRole('button', { name: /18 or older/i })).not.toBeInTheDocument();
  });

  it.each([false, true])('cancels deferred mute-resume playback after unmount (outer frame completed: %s)', (advanceOuter) => {
    const { frames, cancelFrame } = stubDeferredFrames();
    const play = HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>;
    const { unmount } = render(<VideoPlayer videoId="real-age" src="https://example.com/public.mp4" />);
    expect(frames.size).toBeGreaterThan(0);
    if (advanceOuter) {
      const first = frames.entries().next().value;
      if (!first) throw new Error('Expected outer mute-resume frame');
      frames.delete(first[0]);
      act(() => first[1](0));
    }
    const ownedFrames = [...frames.keys()];
    play.mockClear();
    unmount();
    act(() => {
      while (frames.size > 0) {
        const pending = frames.entries().next().value;
        if (!pending) break;
        frames.delete(pending[0]);
        pending[1](0);
      }
    });
    expect(play).not.toHaveBeenCalled();
    ownedFrames.forEach(id => expect(cancelFrame).toHaveBeenCalledWith(id));
  });

  it('cancels the previous mute-resume frame before scheduling a changed mute state', () => {
    const { frames, cancelFrame } = stubDeferredFrames();
    const { rerender, unmount } = render(<VideoPlayer videoId="real-age" src="https://example.com/public.mp4" />);
    const previousFrames = [...frames.keys()];
    expect(previousFrames).toHaveLength(1);
    playbackState.muted = false;
    rerender(<VideoPlayer videoId="real-age" src="https://example.com/public.mp4" />);
    previousFrames.forEach(id => {
      expect(cancelFrame).toHaveBeenCalledWith(id);
      expect(frames.has(id)).toBe(false);
    });
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
  });
});
