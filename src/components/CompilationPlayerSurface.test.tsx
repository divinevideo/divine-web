import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CompilationPlayerSurface } from './CompilationPlayerSurface';

vi.mock('@/components/VideoPlayer', () => ({
  VideoPlayer: ({
    onEnded,
  }: {
    onEnded?: () => void;
    children?: ReactNode;
  }) => <video data-testid="compilation-video" onEnded={onEnded} />,
}));

const videos = [
  {
    id: 'video-a',
    pubkey: 'a'.repeat(64),
    videoUrl: 'https://example.com/a.mp4',
    title: 'Video A',
  },
  {
    id: 'video-b',
    pubkey: 'b'.repeat(64),
    videoUrl: 'https://example.com/b.mp4',
    title: 'Video B',
  },
  {
    id: 'video-c',
    pubkey: 'c'.repeat(64),
    videoUrl: 'https://example.com/c.mp4',
    title: 'Video C',
  },
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
});
