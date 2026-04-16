import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FullscreenFeed } from './FullscreenFeed';
import { SHORT_VIDEO_KIND, type ParsedVideoData } from '@/types/video';

vi.mock('@/hooks/useVideoPlayback', () => ({
  useVideoPlayback: () => ({
    globalMuted: true,
    setGlobalMuted: vi.fn(),
  }),
}));

vi.mock('@/hooks/useDeferredVideoMetrics', () => ({
  useDeferredVideoMetrics: () => ({
    socialMetrics: { data: null },
    userInteractions: { data: null },
  }),
}));

vi.mock('@/hooks/useOptimisticLike', () => ({
  useOptimisticLike: () => ({
    toggleLike: vi.fn(),
  }),
}));

vi.mock('@/hooks/useOptimisticRepost', () => ({
  useOptimisticRepost: () => ({
    toggleRepost: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: null,
  }),
}));

vi.mock('@/contexts/LoginDialogContext', () => ({
  useLoginDialog: () => ({
    openLoginDialog: vi.fn(),
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/hooks/useShare', () => ({
  useShare: () => ({
    share: vi.fn(),
  }),
}));

vi.mock('@/lib/shareUtils', () => ({
  getVideoShareData: vi.fn(),
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

vi.mock('@/components/FullscreenVideoItem', () => ({
  FullscreenVideoItem: ({
    video,
    isActive,
    onEnded,
  }: {
    video: { id: string };
    isActive: boolean;
    onEnded?: () => void;
  }) => (
    <div data-testid={`fullscreen-item-${video.id}`} data-active={String(isActive)}>
      <button type="button" onClick={onEnded}>
        end-{video.id}
      </button>
    </div>
  ),
}));

function makeVideo(id: string): ParsedVideoData {
  return {
    id,
    pubkey: id[0].repeat(64),
    kind: SHORT_VIDEO_KIND,
    createdAt: 1,
    content: '',
    videoUrl: `https://example.com/${id}.mp4`,
    title: id,
    hashtags: [],
    vineId: null,
    isVineMigrated: false,
    reposts: [],
  };
}

describe('FullscreenFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('auto-advances to the next fullscreen item in compilation mode', () => {
    render(
      <FullscreenFeed
        videos={[makeVideo('video-a'), makeVideo('video-b')]}
        startIndex={0}
        onClose={vi.fn()}
        autoAdvance
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'end-video-a' }));

    expect(screen.getByTestId('fullscreen-item-video-b')).toHaveAttribute('data-active', 'true');
  });

  it('requests only one additional page while waiting at the loaded tail', () => {
    const onLoadMore = vi.fn();

    render(
      <FullscreenFeed
        videos={[makeVideo('video-a')]}
        startIndex={0}
        onClose={vi.fn()}
        autoAdvance
        onLoadMore={onLoadMore}
        hasMore
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'end-video-a' }));
    fireEvent.click(screen.getByRole('button', { name: 'end-video-a' }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
