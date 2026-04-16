import { fireEvent, render, screen } from '@testing-library/react';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ImgHTMLAttributes,
  ReactNode,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParsedVideoData } from '@/types/video';
import { VideoCard } from './VideoCard';

const playbackMocks = vi.hoisted(() => ({
  activeVideoId: null as string | null,
  setActiveVideo: vi.fn(),
  setGlobalMuted: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
  share: vi.fn(),
  muteAsync: vi.fn(),
  deleteVideo: vi.fn(),
  pinVideo: vi.fn(),
  unpinVideo: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  openLoginDialog: vi.fn(),
  confirmAdult: vi.fn(),
  useCurrentUser: vi.fn(),
  useAdultVerification: vi.fn(),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  CardContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  AvatarImage: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
  AvatarFallback: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <div />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/VideoPlayer', () => ({
  VideoPlayer: ({
    videoId,
    onPlaybackStarted,
  }: {
    videoId: string;
    onPlaybackStarted?: () => void;
  }) => (
    <div data-testid={`video-player-${videoId}`}>
      Video Player
      <button
        aria-label={`start-playback-${videoId}`}
        onClick={onPlaybackStarted}
        type="button"
      >
        Start playback
      </button>
    </div>
  ),
}));

vi.mock('@/components/ThumbnailPlayer', () => ({
  ThumbnailPlayer: ({
    onClick,
    onPlayButtonClick,
  }: {
    onClick?: () => void;
    onPlayButtonClick?: () => void;
  }) => (
    <div data-testid="thumbnail-player">
      <button onClick={onClick} type="button">
        Thumbnail
      </button>
      <button aria-label="Play video" onClick={onPlayButtonClick} type="button">
        Play
      </button>
    </div>
  ),
}));

vi.mock('@/components/VideoCommentsModal', () => ({
  VideoCommentsModal: () => null,
}));

vi.mock('@/components/VideoReactionsModal', () => ({
  VideoReactionsModal: () => null,
}));

vi.mock('@/components/NoteContent', () => ({
  NoteContent: ({ event }: { event: { content: string } }) => (
    <div>{event.content}</div>
  ),
}));

vi.mock('@/components/InlineNostrText', () => ({
  InlineNostrText: ({ text }: { text: string }) => <>{text}</>,
}));

vi.mock('@/components/AddToListDialog', () => ({
  AddToListDialog: () => null,
}));

vi.mock('@/components/ReportContentDialog', () => ({
  ReportContentDialog: () => null,
}));

vi.mock('@/components/DeleteVideoDialog', () => ({
  DeleteVideoDialog: () => null,
}));

vi.mock('@/components/ViewSourceDialog', () => ({
  ViewSourceDialog: () => null,
}));

vi.mock('@/components/VideoVerificationBadgeRow', () => ({
  VideoVerificationBadgeRow: () => <div>Badges</div>,
}));

vi.mock('@/components/SmartLink', () => ({
  SmartLink: ({
    children,
    ownerPubkey: _ownerPubkey,
    ...props
  }: HTMLAttributes<HTMLAnchorElement> & { ownerPubkey?: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: {
      metadata: {
        name: 'Video Author',
        picture: 'https://example.com/avatar.jpg',
      },
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/useModeration', () => ({
  useMuteItem: () => ({
    mutateAsync: playbackMocks.muteAsync,
  }),
}));

vi.mock('@/hooks/useDeleteVideo', () => ({
  useDeleteVideo: () => ({
    mutate: playbackMocks.deleteVideo,
    isPending: false,
  }),
  useCanDeleteVideo: () => false,
}));

vi.mock('@/hooks/usePinnedVideos', () => ({
  useIsVideoPinned: () => false,
  usePinVideo: () => ({
    mutateAsync: playbackMocks.pinVideo,
  }),
  useUnpinVideo: () => ({
    mutateAsync: playbackMocks.unpinVideo,
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => authMocks.useCurrentUser(),
}));

vi.mock('@/hooks/useAdultVerification', () => ({
  useAdultVerification: () => authMocks.useAdultVerification(),
}));

vi.mock('@/hooks/useVideoPlayback', () => ({
  useVideoPlayback: () => ({
    activeVideoId: playbackMocks.activeVideoId,
    setActiveVideo: playbackMocks.setActiveVideo,
    registerVideo: vi.fn(),
    unregisterVideo: vi.fn(),
    updateVideoVisibility: vi.fn(),
    globalMuted: true,
    setGlobalMuted: playbackMocks.setGlobalMuted,
  }),
}));

vi.mock('@/hooks/useVideoLists', () => ({
  useVideosInLists: () => ({
    data: [],
  }),
}));

vi.mock('@/hooks/useVideoReactions', () => ({
  useVideoReactions: () => ({
    data: null,
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: playbackMocks.toast,
  }),
}));

vi.mock('@/hooks/useShare', () => ({
  useShare: () => ({
    share: playbackMocks.share,
  }),
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({
    canUseDirectMessages: false,
  }),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => playbackMocks.navigate,
}));

vi.mock('@/hooks/useBandwidthTier', () => ({
  useBandwidthTier: () => 'default',
}));

vi.mock('@/hooks/useSubtitles', () => ({
  useSubtitles: () => ({
    cues: [],
    hasSubtitles: false,
  }),
}));

vi.mock('@/contexts/LoginDialogContext', () => ({
  useLoginDialog: () => ({
    openLoginDialog: authMocks.openLoginDialog,
  }),
}));

vi.mock('@/lib/generateProfile', () => ({
  enhanceAuthorData: (
    data: { metadata?: Record<string, unknown> } | undefined,
    pubkey: string
  ) => ({
    metadata: data?.metadata ?? { name: pubkey },
  }),
}));

vi.mock('@/lib/genUserName', () => ({
  genUserName: () => 'Generated User',
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' '),
}));

vi.mock('@/lib/formatUtils', () => ({
  formatClassicVineViewBreakdown: () => '0 views',
  formatViewCount: (count: number) => String(count),
  formatCount: (count: number) => String(count),
}));

vi.mock('@/lib/imageUtils', () => ({
  getSafeProfileImage: (url?: string) => url ?? '',
}));

vi.mock('@/lib/shareUtils', () => ({
  getVideoShareData: () => ({}),
}));

vi.mock('@/lib/bandwidthTracker', () => ({
  getOptimalVideoUrl: (url: string) => url,
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

function makeVideo(overrides: Partial<ParsedVideoData> = {}): ParsedVideoData {
  return {
    id: 'video-1',
    pubkey: 'f'.repeat(64),
    kind: 34236,
    createdAt: 1700000000,
    content: 'Test video',
    title: 'Test video',
    videoUrl: 'https://media.divine.video/video-1',
    thumbnailUrl: 'https://media.divine.video/video-1.jpg',
    hashtags: [],
    vineId: 'vine-id-1',
    reposts: [],
    isVineMigrated: false,
    ageRestricted: false,
    ...overrides,
  };
}

const baseVideo = {
  id: 'video-1',
  kind: 34236,
  pubkey: 'f'.repeat(64),
  authorName: 'Video Author',
  authorAvatar: 'https://example.com/avatar.jpg',
  videoUrl: 'https://example.com/video.mp4',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  duration: 6,
  createdAt: 1_700_000_000,
  hashtags: [],
  reposts: [],
  content: '',
  title: 'Test Video',
  likeCount: 0,
  repostCount: 0,
  commentCount: 0,
  divineViewCount: 0,
  loopCount: 0,
  isVineMigrated: false,
  originalVineTimestamp: undefined,
  dimensions: '1080x1920',
  fallbackVideoUrls: [],
  hlsUrl: undefined,
  vineId: 'vine-id-1',
} as unknown as ParsedVideoData;

describe('VideoCard', () => {
  beforeEach(() => {
    playbackMocks.activeVideoId = null;
    playbackMocks.setActiveVideo.mockClear();
    playbackMocks.setGlobalMuted.mockClear();
    playbackMocks.navigate.mockClear();
    playbackMocks.toast.mockClear();
    playbackMocks.share.mockClear();
    authMocks.openLoginDialog.mockClear();
    authMocks.confirmAdult.mockClear();
    authMocks.useCurrentUser.mockReturnValue({ user: null });
    authMocks.useAdultVerification.mockReturnValue({
      isVerified: false,
      confirmAdult: authMocks.confirmAdult,
      revokeVerification: vi.fn(),
      getAuthHeader: vi.fn(),
      isLoading: false,
      hasSigner: false,
    });
  });

  it('marks a thumbnail-mode video active when inline playback starts', () => {
    render(<VideoCard video={baseVideo} mode="thumbnail" />);

    fireEvent.click(screen.getByLabelText('Play video'));

    expect(playbackMocks.setActiveVideo).toHaveBeenCalledWith(baseVideo.id);
    expect(screen.getByTestId(`video-player-${baseVideo.id}`)).toBeTruthy();
  });

  it('keeps the thumbnail visible until inline playback actually starts', () => {
    render(<VideoCard video={baseVideo} mode="thumbnail" />);

    fireEvent.click(screen.getByLabelText('Play video'));

    expect(screen.getByTestId(`video-player-${baseVideo.id}`)).toBeTruthy();
    expect(screen.getByTestId('thumbnail-player')).toBeTruthy();

    fireEvent.click(screen.getByLabelText(`start-playback-${baseVideo.id}`));

    expect(screen.queryByTestId('thumbnail-player')).toBeNull();
  });

  it('stops inline thumbnail playback when another video becomes active', () => {
    const { rerender } = render(<VideoCard video={baseVideo} mode="thumbnail" />);

    fireEvent.click(screen.getByLabelText('Play video'));
    expect(screen.getByTestId(`video-player-${baseVideo.id}`)).toBeTruthy();

    playbackMocks.activeVideoId = 'video-2';
    rerender(<VideoCard video={baseVideo} mode="thumbnail" />);

    expect(screen.queryByTestId(`video-player-${baseVideo.id}`)).toBeNull();
    expect(screen.getByTestId('thumbnail-player')).toBeTruthy();
  });

  it('shows a logged-out gated card instead of mounting thumbnail media', () => {
    render(
      <VideoCard
        video={makeVideo({
          ageRestricted: true,
          title: 'Constructive criticism',
        })}
        mode="thumbnail"
      />
    );

    expect(screen.getByText('Log in to view')).toBeInTheDocument();
    expect(screen.queryByTestId('thumbnail-player')).not.toBeInTheDocument();
    expect(screen.queryByTestId(/video-player-/)).not.toBeInTheDocument();
  });

  it('shows an age-verification prompt for logged-in viewers who are not verified', () => {
    authMocks.useCurrentUser.mockReturnValue({
      user: { pubkey: 'a'.repeat(64) },
    });

    render(
      <VideoCard
        video={makeVideo({
          ageRestricted: true,
        })}
        mode="thumbnail"
      />
    );

    expect(screen.getByText('Verify age to view')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Verify age to view' }));
    expect(authMocks.confirmAdult).toHaveBeenCalledTimes(1);
  });

  it('still renders the thumbnail player for unrestricted videos', () => {
    render(
      <VideoCard
        video={makeVideo({
          ageRestricted: false,
        })}
        mode="thumbnail"
      />
    );

    expect(screen.getByTestId('thumbnail-player')).toBeInTheDocument();
    expect(screen.queryByText('Log in to view')).not.toBeInTheDocument();
  });
});
