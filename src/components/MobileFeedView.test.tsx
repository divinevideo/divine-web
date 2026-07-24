import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ParsedVideoData } from '@/types/video';
import { MobileFeedView } from './MobileFeedView';

vi.mock('@/components/MobileVideoItem', () => ({
  MobileVideoItem: ({
    video,
    isActive,
    onOpenComments,
  }: {
    video: ParsedVideoData;
    isActive: boolean;
    onOpenComments?: (video: ParsedVideoData) => void;
  }) => (
    <section data-testid="mobile-video-item" data-active={isActive}>
      <p>{video.title}</p>
      <button type="button" onClick={() => onOpenComments?.(video)}>
        Comments for {video.title}
      </button>
    </section>
  ),
}));

function makeVideo(id: string): ParsedVideoData {
  return {
    id,
    pubkey: `${id}pubkey`,
    title: `Video ${id}`,
    content: '',
    videoUrl: `https://example.com/${id}.mp4`,
    thumbnailUrl: '',
    hashtags: [],
    vineId: null,
    isVineMigrated: false,
    reposts: [],
    createdAt: 1,
    kind: 34236,
  };
}

describe('MobileFeedView', () => {
  it('opens comments for the selected mobile video', () => {
    const onOpenComments = vi.fn();
    const video = makeVideo('one');

    render(<MobileFeedView videos={[video]} onOpenComments={onOpenComments} />);

    fireEvent.click(screen.getByRole('button', { name: 'Comments for Video one' }));

    expect(onOpenComments).toHaveBeenCalledWith(video);
  });

  it('mounts only nearby video items while preserving snap positions', () => {
    const videos = Array.from({ length: 12 }, (_, index) => makeVideo(`${index}`));

    render(<MobileFeedView videos={videos} />);

    expect(screen.getAllByTestId('mobile-video-item')).toHaveLength(4);
    expect(screen.queryByText('Video 4')).not.toBeInTheDocument();
  });

  it('uses feed keyboard shortcuts outside editable controls', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    render(<MobileFeedView videos={[makeVideo('one'), makeVideo('two')]} />);

    fireEvent.keyDown(window, { key: 'j' });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('ignores feed keyboard shortcuts from editable controls', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    render(
      <>
        <input aria-label="Comment" />
        <MobileFeedView videos={[makeVideo('one'), makeVideo('two')]} />
      </>
    );

    fireEvent.keyDown(screen.getByLabelText('Comment'), { key: 'j' });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
