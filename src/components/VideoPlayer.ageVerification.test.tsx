import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VideoPlayer } from './VideoPlayer';
import { initializeI18n } from '@/lib/i18n';
import type { ParsedVideoData } from '@/types/video';

const { signer, registerVideo, unregisterVideo, updateVideoVisibility } = vi.hoisted(() => ({
  signer: { signEvent: vi.fn() },
  registerVideo: vi.fn(), unregisterVideo: vi.fn(), updateVideoVisibility: vi.fn(),
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
    activeVideoId: 'real-age', globalMuted: true, setUserPaused: vi.fn(),
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

describe('VideoPlayer with real adult verification', () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(async () => {
    localStorage.clear();
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
});
