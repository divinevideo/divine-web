import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';
import { VideoPlaybackProvider } from './VideoPlaybackContext';

function Harness() {
  const { activeVideoId, setActiveVideo, updateVideoVisibility } = useVideoPlayback();

  return (
    <div>
      <div data-testid="active-video-id">{activeVideoId ?? ''}</div>
      <button
        type="button"
        onClick={() => setActiveVideo('fullscreen:video-1')}
      >
        activate-fullscreen
      </button>
      <button
        type="button"
        onClick={() => updateVideoVisibility('video-1', 1)}
      >
        inline-visible
      </button>
      <button
        type="button"
        onClick={() => updateVideoVisibility('fullscreen:video-1', 1)}
      >
        fullscreen-visible
      </button>
    </div>
  );
}

describe('VideoPlaybackContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the fullscreen video active when fullscreen and inline videos are equally visible', async () => {
    render(
      <VideoPlaybackProvider>
        <Harness />
      </VideoPlaybackProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'activate-fullscreen' }));
    fireEvent.click(screen.getByRole('button', { name: 'inline-visible' }));
    fireEvent.click(screen.getByRole('button', { name: 'fullscreen-visible' }));

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByTestId('active-video-id')).toHaveTextContent('fullscreen:video-1');
  });
});
