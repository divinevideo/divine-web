import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CompilationPlayerSurface } from './CompilationPlayerSurface';
import { SHORT_VIDEO_KIND, type ParsedVideoData } from '@/types/video';

vi.mock('@/components/VideoPlayer', () => ({
  VideoPlayer: ({
    onEnded,
  }: {
    onEnded?: () => void;
    children?: ReactNode;
  }) => <video data-testid="compilation-video" onEnded={onEnded} />,
}));

function makeVideo(id: string, title: string): ParsedVideoData {
  return {
    id,
    pubkey: id[0].repeat(64),
    kind: SHORT_VIDEO_KIND,
    createdAt: 1,
    content: `${title} content`,
    videoUrl: `https://example.com/${id}.mp4`,
    title,
    hashtags: [],
    vineId: null,
    isVineMigrated: false,
    reposts: [],
  };
}

const videos = [
  makeVideo('video-a', 'Video A'),
  makeVideo('video-b', 'Video B'),
  makeVideo('video-c', 'Video C'),
] as const;

describe('CompilationPlayerSurface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('advances to the next video and reports the new video id on ended', () => {
    const replaceVideoQueryParam = vi.fn();

    render(
      <CompilationPlayerSurface
        videos={videos}
        initialIndex={0}
        replaceVideoQueryParam={replaceVideoQueryParam}
      />
    );

    fireEvent.ended(screen.getByTestId('compilation-video'));

    expect(replaceVideoQueryParam).toHaveBeenCalledWith('video-b');
    expect(screen.getByText('Video B')).toBeInTheDocument();
  });

  it('requests another page when playback nears the end of loaded videos', () => {
    const fetchNextPage = vi.fn();

    render(
      <CompilationPlayerSurface
        videos={videos}
        initialIndex={1}
        hasNextPage
        fetchNextPage={fetchNextPage}
      />
    );

    fireEvent.ended(screen.getByTestId('compilation-video'));

    expect(fetchNextPage).toHaveBeenCalled();
  });

  it('preloads the next two videos while the current one plays', () => {
    render(<CompilationPlayerSurface videos={videos} initialIndex={0} />);

    expect(screen.getByTestId('compilation-preload-video-video-b')).toHaveAttribute('preload', 'auto');
    expect(screen.getByTestId('compilation-preload-video-video-c')).toHaveAttribute('preload', 'auto');
  });
});
