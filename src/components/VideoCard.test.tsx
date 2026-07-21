import { fireEvent, render, screen } from '@testing-library/react';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ImgHTMLAttributes,
  ReactNode,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import type { ParsedVideoData } from '@/types/video';
import { initializeI18n } from '@/lib/i18n';
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

const authorMocks = vi.hoisted(() => ({
  metadata: {
    name: 'Video Author',
    picture: 'https://example.com/avatar.jpg',
  } as Record<string, unknown>,
  useNip05Validation: vi.fn(),
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
    hlsUrl,
    onError,
    onPlaybackStarted,
  }: {
    videoId: string;
    hlsUrl?: string;
    onError?: () => void;
    onPlaybackStarted?: () => void;
  }) => (
    <div data-testid={`video-player-${videoId}`} data-hls-url={hlsUrl ?? ''}>
      Video Player
      <button
        aria-label={`fail-video-${videoId}`}
        onClick={onError}
        type="button"
      >
        Fail video
      </button>
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
    linkTo,
  }: {
    onClick?: () => void;
    onPlayButtonClick?: () => void;
    linkTo?: string;
  }) => (
    <div data-testid="thumbnail-player">
      {linkTo && (
        <a href={linkTo} data-testid="thumbnail-link">
          Open video
        </a>
      )}
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
    to,
    ...props
  }: HTMLAttributes<HTMLAnchorElement> & { ownerPubkey?: string; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: {
      metadata: authorMocks.metadata,
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useNip05Validation', () => ({
  useNip05Validation: authorMocks.useNip05Validation,
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
  formatClassicVineViewBreakdown: (_totalViews: number, originalLoops: number) =>
    originalLoops > 0 ? `${originalLoops} Classic Loops` : null,
  formatLoopCount: (count: number) => `${count} Loops`,
  formatViewCount: (count: number) => `${count} views`,
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
  beforeEach(async () => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
    });
    await initializeI18n({ force: true, languages: ['en-US'] });
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
    authorMocks.metadata = {
      name: 'Video Author',
      picture: 'https://example.com/avatar.jpg',
    };
    authorMocks.useNip05Validation.mockReturnValue({
      isValid: false,
      isLoading: false,
      isInvalid: true,
      state: 'invalid',
      nip05: undefined,
    });
  });

  it('renders the thumbnail as a real link to the video page in thumbnail mode', () => {
    render(<VideoCard video={baseVideo} mode="thumbnail" />);

    const link = screen.getByTestId('thumbnail-link');
    expect(link).toHaveAttribute('href', `/video/${baseVideo.id}`);
    expect(playbackMocks.navigate).not.toHaveBeenCalled();
  });

  it('links the author through a friendly profile path when NIP-05 is valid', () => {
    authorMocks.metadata = {
      name: 'Video Author',
      picture: 'https://example.com/avatar.jpg',
      nip05: '_@author.divine.video',
    };
    authorMocks.useNip05Validation.mockReturnValue({
      isValid: true,
      isLoading: false,
      isInvalid: false,
      state: 'valid',
      nip05: '_@author.divine.video',
    });

    render(<VideoCard video={baseVideo} mode="thumbnail" />);

    expect(screen.getByRole('link', { name: 'Video Author' })).toHaveAttribute('href', '/u/author');
  });

  it('links the author through npub when NIP-05 is invalid', () => {
    authorMocks.metadata = {
      name: 'Video Author',
      picture: 'https://example.com/avatar.jpg',
      nip05: 'author@spoofed.example',
    };

    render(<VideoCard video={baseVideo} mode="thumbnail" />);

    expect(screen.getByRole('link', { name: 'Video Author' })).toHaveAttribute(
      'href',
      `/${nip19.npubEncode(baseVideo.pubkey)}`,
    );
  });

  it('builds the thumbnail link from the navigation context when provided', () => {
    render(
      <VideoCard
        video={baseVideo}
        mode="thumbnail"
        navigationContext={{ source: 'search', query: 'cats' }}
        videoIndex={2}
      />
    );

    const href = screen.getByTestId('thumbnail-link').getAttribute('href') ?? '';
    expect(href).toContain(`/video/${baseVideo.id}`);
    expect(href).toContain('source=search');
    expect(href).toContain('q=cats');
    expect(href).toContain('index=2');
  });

  it('does not render a thumbnail link in auto-play mode', () => {
    render(<VideoCard video={makeVideo({ id: 'video-1' })} mode="auto-play" />);

    expect(screen.queryByTestId('thumbnail-link')).not.toBeInTheDocument();
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

  it('renders the native playback total instead of raw loop count', () => {
    render(
      <VideoCard
        video={makeVideo({
          loopCount: 10,
          isVineMigrated: false,
        })}
        viewCount={31}
      />
    );

    expect(screen.getByText('31 Loops')).toBeInTheDocument();
    expect(screen.queryByText('10 Classic Loops')).not.toBeInTheDocument();
  });

  it('uses native loop labeling for non-migrated videos with old publish timestamps', () => {
    render(
      <VideoCard
        video={makeVideo({
          loopCount: 10,
          isVineMigrated: false,
          originalVineTimestamp: 1_400_000_000,
        })}
        viewCount={31}
      />
    );

    expect(screen.getByText('31 Loops')).toBeInTheDocument();
    expect(screen.queryByText('10 Classic Loops')).not.toBeInTheDocument();
  });

  it('keeps migrated Vine cards on the archived loop count', () => {
    render(
      <VideoCard
        video={makeVideo({
          loopCount: 10,
          isVineMigrated: true,
          originalVineTimestamp: 1_400_000_000,
        })}
        viewCount={31}
      />
    );

    expect(screen.getByText('10 Classic Loops')).toBeInTheDocument();
    expect(screen.queryByText('31 Loops')).not.toBeInTheDocument();
  });

  it('lets failed playback be retried without remounting the card', () => {
    const video = makeVideo();
    render(<VideoCard video={video} />);

    fireEvent.click(screen.getByLabelText(`fail-video-${video.id}`));
    expect(screen.getByTestId(`video-player-${video.id}`)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(`fail-video-${video.id}`));
    expect(screen.getByText('Failed to load video')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(screen.getByTestId(`video-player-${video.id}`)).toBeInTheDocument();
    expect(screen.queryByText('Failed to load video')).not.toBeInTheDocument();
  });
});
