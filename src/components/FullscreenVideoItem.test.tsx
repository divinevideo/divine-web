// ABOUTME: Tests for FullscreenVideoItem author profile link behavior
// ABOUTME: Guards against routing through the unreliable /u/<nip05> resolver

import { render, screen } from '@testing-library/react';
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
import { FullscreenVideoItem } from './FullscreenVideoItem';

const { authorMocks } = vi.hoisted(() => ({
  authorMocks: {
    metadata: {
      name: 'Video Author',
      picture: 'https://example.com/avatar.jpg',
    } as Record<string, unknown>,
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
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
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <div />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/VideoPlayer', () => ({
  VideoPlayer: () => <div data-testid="video-player" />,
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

vi.mock('@/components/InlineBadges', () => ({
  InlineBadges: () => null,
}));

vi.mock('@/components/VideoVerificationBadgeRow', () => ({
  VideoVerificationBadgeRow: () => null,
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
    data: { metadata: authorMocks.metadata },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useVideoPlayback', () => ({
  useVideoPlayback: () => ({
    globalMuted: true,
    setGlobalMuted: vi.fn(),
    setActiveVideo: vi.fn(),
  }),
}));

vi.mock('@/hooks/useVideoReactions', () => ({
  useVideoReactions: () => ({ data: null }),
}));

vi.mock('@/hooks/useVideoLists', () => ({
  useVideosInLists: () => ({ data: [] }),
}));

vi.mock('@/hooks/useModeration', () => ({
  useMuteItem: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/useDeleteVideo', () => ({
  useDeleteVideo: () => ({ mutate: vi.fn(), isPending: false }),
  useCanDeleteVideo: () => false,
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({ canUseDirectMessages: false }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/useBadges', () => ({
  useBadges: () => ({ data: [] }),
}));

vi.mock('@/hooks/useBandwidthTier', () => ({
  useBandwidthTier: () => 'default',
}));

vi.mock('@/hooks/useSubtitles', () => ({
  useSubtitles: () => ({ cues: [], hasSubtitles: false }),
}));

vi.mock('@/lib/generateProfile', () => ({
  enhanceAuthorData: (
    data: { metadata?: Record<string, unknown> } | undefined,
    pubkey: string,
  ) => ({
    metadata: data?.metadata ?? { name: pubkey },
  }),
}));

vi.mock('@/lib/genUserName', () => ({
  genUserName: () => 'Generated User',
}));

vi.mock('@/lib/imageUtils', () => ({
  getSafeProfileImage: (url?: string) => url ?? '',
}));

vi.mock('@/lib/bandwidthTracker', () => ({
  getOptimalVideoUrl: (url: string) => url,
}));

const AUTHOR_PUBKEY = 'f'.repeat(64);

const baseVideo = {
  id: 'video-1',
  kind: 34236,
  pubkey: AUTHOR_PUBKEY,
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
  isVineMigrated: false,
  ageRestricted: false,
  vineId: 'vine-id-1',
  fallbackVideoUrls: [],
} as unknown as ParsedVideoData;

function renderItem() {
  return render(
    <FullscreenVideoItem
      video={baseVideo}
      isActive={false}
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
    />,
  );
}

describe('FullscreenVideoItem', () => {
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
    authorMocks.metadata = {
      name: 'Video Author',
      picture: 'https://example.com/avatar.jpg',
    };
  });

  it('links the author directly to their npub profile', () => {
    renderItem();

    const link = screen.getByText('Video Author').closest('a');
    expect(link).toHaveAttribute('href', `/${nip19.npubEncode(AUTHOR_PUBKEY)}`);
  });

  it('keeps the direct npub link when author metadata includes a NIP-05 alias', () => {
    authorMocks.metadata = {
      name: 'Video Author',
      picture: 'https://example.com/avatar.jpg',
      nip05: 'video-author@divine.video',
    };

    renderItem();

    const link = screen.getByText('Video Author').closest('a');
    expect(link).toHaveAttribute('href', `/${nip19.npubEncode(AUTHOR_PUBKEY)}`);
  });
});
