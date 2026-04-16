import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThumbnailPlayer } from './ThumbnailPlayer';

vi.mock('@/hooks/useAdultVerification', () => ({
  useAdultVerification: vi.fn(() => ({
    isVerified: true,
  })),
  checkMediaAuth: vi.fn().mockResolvedValue({ authorized: true, status: 200 }),
}));

vi.mock('@/components/AgeVerificationOverlay', () => ({
  AgeVerificationOverlay: () => <div>Age verification</div>,
}));

vi.mock('@/lib/debug', () => ({
  verboseLog: vi.fn(),
  debugError: vi.fn(),
}));

describe('ThumbnailPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets the play button start playback without triggering the thumbnail click action', () => {
    const handleThumbnailClick = vi.fn();
    const handlePlayButtonClick = vi.fn();

    render(
      <ThumbnailPlayer
        videoId="video-123"
        src="https://example.com/video.mp4"
        thumbnailUrl="https://example.com/thumb.jpg"
        onClick={handleThumbnailClick}
        onPlayButtonClick={handlePlayButtonClick}
      />
    );

    fireEvent.click(screen.getByLabelText('Play video'));

    expect(handlePlayButtonClick).toHaveBeenCalledTimes(1);
    expect(handleThumbnailClick).not.toHaveBeenCalled();
  });

  it('still delegates container clicks to the thumbnail click action', () => {
    const handleThumbnailClick = vi.fn();

    render(
      <ThumbnailPlayer
        videoId="video-123"
        src="https://example.com/video.mp4"
        thumbnailUrl="https://example.com/thumb.jpg"
        onClick={handleThumbnailClick}
      />
    );

    fireEvent.click(screen.getByTestId('thumbnail-container'));

    expect(handleThumbnailClick).toHaveBeenCalledTimes(1);
  });
});
