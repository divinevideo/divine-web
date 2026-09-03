import { fireEvent, render, screen } from '@testing-library/react';
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParsedVideoData } from '@/types/video';
import { FullscreenVideoItem } from './FullscreenVideoItem';

const playbackMocks = vi.hoisted(() => ({
  setActiveVideo: vi.fn(),
  setUserPaused: vi.fn(),
  setGlobalMuted: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  useCurrentUser: vi.fn(() => ({ user: null as { pubkey: string } | null })),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => authMocks.useCurrentUser(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/useVideoPlayback', () => ({
  useVideoPlayback: () => ({
    activeVideoId: 'fs:video-1',
    userPausedVideoId: null,
    setActiveVideo: playbackMocks.setActiveVideo,
    setUserPaused: playbackMocks.setUserPaused,
    globalMuted: true,
    setGlobalMuted: playbackMocks.setGlobalMuted,
  }),
}));

vi.mock('@/hooks/useAuthor', () => ({ useAuthor: () => ({ data: undefined }) }));
vi.mock('@/lib/generateProfile', () => ({
  enhanceAuthorData: () => ({ metadata: {} }),
}));
vi.mock('@/hooks/useVideoReactions', () => ({ useVideoReactions: () => ({ data: undefined }) }));
vi.mock('@/hooks/useVideoLists', () => ({ useVideosInLists: () => ({ data: undefined }) }));
vi.mock('@/hooks/useModeration', () => ({ useMuteItem: () => ({ mutateAsync: vi.fn() }) }));
vi.mock('@/hooks/useDeleteVideo', () => ({
  useDeleteVideo: () => ({ mutate: vi.fn(), isPending: false }),
  useCanDeleteVideo: () => false,
}));
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useBadges', () => ({ useBadges: () => ({ data: undefined }) }));
vi.mock('@/hooks/useBandwidthTier', () => ({ useBandwidthTier: () => 'high' }));
vi.mock('@/lib/bandwidthTracker', () => ({ getOptimalVideoUrl: (url: string) => url }));
vi.mock('@/hooks/useSubtitles', () => ({ useSubtitles: () => ({ cues: [], hasSubtitles: false }) }));
vi.mock('@/hooks/useValidatedProfileLinkPath', () => ({
  useValidatedProfileLinkPath: () => '/profile/test',
}));

// Forward the ref to the <video> so the component can target its own element,
// exactly as the real VideoPlayer does via setRefs.
vi.mock('@/components/VideoPlayer', () => ({
  VideoPlayer: forwardRef<HTMLVideoElement, { videoId: string }>(({ videoId }, ref) => (
    <video ref={ref} data-testid={`vp-${videoId}`} />
  )),
}));

vi.mock('@/components/VideoCommentsModal', () => ({ VideoCommentsModal: () => null }));
vi.mock('@/components/VideoReactionsModal', () => ({ VideoReactionsModal: () => null }));
vi.mock('@/components/NoteContent', () => ({ NoteContent: () => null }));
vi.mock('@/components/AddToListDialog', () => ({ AddToListDialog: () => null }));
vi.mock('@/components/ReportContentDialog', () => ({ ReportContentDialog: () => null }));
vi.mock('@/components/DeleteVideoDialog', () => ({ DeleteVideoDialog: () => null }));
vi.mock('@/components/ViewSourceDialog', () => ({ ViewSourceDialog: () => null }));
vi.mock('@/components/InlineBadges', () => ({ InlineBadges: () => null }));
vi.mock('@/components/VideoVerificationBadgeRow', () => ({ VideoVerificationBadgeRow: () => null }));
vi.mock('@/components/SmartLink', () => ({
  SmartLink: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <div />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  AvatarImage: () => <img alt="" />,
  AvatarFallback: ({ children }: HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: HTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

const video = {
  id: 'video-1',
  pubkey: 'f'.repeat(64),
  videoUrl: 'https://example.com/v.mp4',
  hlsUrl: undefined,
  fallbackVideoUrls: [],
  thumbnailUrl: 'https://example.com/t.jpg',
  blurhash: undefined,
  title: 'Test',
  content: '',
  hashtags: [],
  duration: 6,
  createdAt: 1_700_000_000,
  originalVineTimestamp: undefined,
  isVineMigrated: false,
  loopCount: 0,
  vineId: undefined,
  authorName: 'Someone',
  authorAvatar: undefined,
} as unknown as ParsedVideoData;

function renderItem(prefix?: ReactNode) {
  return render(
    <>
      {prefix}
      <FullscreenVideoItem
        video={video}
        isActive
        playbackId="fs:video-1"
        onBack={vi.fn()}
        onLike={vi.fn()}
        onRepost={vi.fn()}
        onShare={vi.fn()}
        onDownload={vi.fn()}
        isLiked={false}
        isReposted={false}
        likeCount={0}
        repostCount={0}
        commentCount={0}
      />
    </>
  );
}

function setPaused(el: HTMLMediaElement, paused: boolean) {
  Object.defineProperty(el, 'paused', { value: paused, configurable: true });
}

describe('FullscreenVideoItem self-moderation affordances', () => {
  beforeEach(() => {
    authMocks.useCurrentUser.mockReturnValue({ user: null });
  });

  it('hides report and mute actions on the viewer\'s own video', () => {
    authMocks.useCurrentUser.mockReturnValue({ user: { pubkey: 'f'.repeat(64) } });
    renderItem();

    expect(screen.queryByText('fullscreenVideoItem.reportVideo')).not.toBeInTheDocument();
    expect(screen.queryByText('fullscreenVideoItem.reportUser')).not.toBeInTheDocument();
    expect(screen.queryByText('fullscreenVideoItem.muteUser')).not.toBeInTheDocument();
  });

  it('shows report and mute actions on another user\'s video', () => {
    authMocks.useCurrentUser.mockReturnValue({ user: { pubkey: 'a'.repeat(64) } });
    renderItem();

    expect(screen.getByText('fullscreenVideoItem.reportVideo')).toBeInTheDocument();
    expect(screen.getByText('fullscreenVideoItem.reportUser')).toBeInTheDocument();
    expect(screen.getByText('fullscreenVideoItem.muteUser')).toBeInTheDocument();
  });
});

describe('FullscreenVideoItem tap-to-pause', () => {
  beforeEach(() => {
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    playbackMocks.setUserPaused.mockReset();
  });

  it('records a user pause in the playback context when a playing video is tapped', () => {
    const { container } = renderItem();
    const itemVideo = container.querySelector<HTMLVideoElement>('[data-testid="vp-video-1"]')!;
    setPaused(itemVideo, false); // playing
    const overlay = container.querySelector('.inset-0.pointer-events-auto');
    if (!overlay) throw new Error('expected the tap overlay to render');

    fireEvent.click(overlay);

    expect(playbackMocks.setUserPaused).toHaveBeenCalledWith('fs:video-1', true);
  });

  it('clears the user pause in the playback context when a paused video is tapped', () => {
    const { container } = renderItem();
    const itemVideo = container.querySelector<HTMLVideoElement>('[data-testid="vp-video-1"]')!;
    setPaused(itemVideo, true); // already paused
    const overlay = container.querySelector('.inset-0.pointer-events-auto');
    if (!overlay) throw new Error('expected the tap overlay to render');

    fireEvent.click(overlay);

    expect(playbackMocks.setUserPaused).toHaveBeenCalledWith('fs:video-1', false);
  });

  it('pauses its own video element, not the first video in the document', () => {
    // The fullscreen feed mounts every item, so multiple <video> elements coexist.
    // A decoy rendered first would win document.querySelector('video').
    const decoy = <video data-testid="decoy" />;
    const { container } = renderItem(decoy);
    const decoyVideo = container.querySelector<HTMLVideoElement>('[data-testid="decoy"]')!;
    const itemVideo = container.querySelector<HTMLVideoElement>('[data-testid="vp-video-1"]')!;
    setPaused(decoyVideo, false);
    setPaused(itemVideo, false);
    const decoyPause = vi.spyOn(decoyVideo, 'pause');
    const itemPause = vi.spyOn(itemVideo, 'pause');

    const overlay = container.querySelector('.inset-0.pointer-events-auto');
    if (!overlay) throw new Error('expected the tap overlay to render');
    fireEvent.click(overlay);

    expect(itemPause).toHaveBeenCalled();
    expect(decoyPause).not.toHaveBeenCalled();
  });
});
