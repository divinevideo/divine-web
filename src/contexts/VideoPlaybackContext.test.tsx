import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';
import { VideoPlaybackProvider } from './VideoPlaybackContext';

function Harness() {
  const { activeVideoId, setActiveVideo, setUserPaused, unregisterVideo, updateVideoVisibility, userPausedVideoId } = useVideoPlayback();

  return (
    <div>
      <div data-testid="active-video-id">{activeVideoId ?? ''}</div>
      <div data-testid="user-paused-video-id">{userPausedVideoId ?? ''}</div>
      <button
        type="button"
        onClick={() => setUserPaused('fullscreen:video-1', true)}
      >
        pause-fullscreen
      </button>
      <button
        type="button"
        onClick={() => setActiveVideo('fullscreen:video-1')}
      >
        reactivate-fullscreen
      </button>
      <button type="button" onClick={() => unregisterVideo('fullscreen:video-1')}>
        unregister-fullscreen
      </button>
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

function IdentityHarness() {
  const playback = useVideoPlayback();
  const initialValue = useRef(playback);
  const initialFunctions = useRef({
    registerVideo: playback.registerVideo,
    setActiveVideo: playback.setActiveVideo,
    setUserPaused: playback.setUserPaused,
    unregisterVideo: playback.unregisterVideo,
    updateVideoVisibility: playback.updateVideoVisibility,
  });
  const functionsAreStable = Object.entries(initialFunctions.current).every(
    ([name, fn]) => playback[name as keyof typeof initialFunctions.current] === fn
  );

  return (
    <div>
      <div data-testid="functions-stable">{String(functionsAreStable)}</div>
      <div data-testid="value-stable">{String(initialValue.current === playback)}</div>
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

  it('keeps context actions stable across provider rerenders', () => {
    const { rerender } = render(
      <VideoPlaybackProvider>
        <IdentityHarness />
      </VideoPlaybackProvider>
    );

    rerender(
      <VideoPlaybackProvider>
        <IdentityHarness />
      </VideoPlaybackProvider>
    );

    expect(screen.getByTestId('functions-stable')).toHaveTextContent('true');
    expect(screen.getByTestId('value-stable')).toHaveTextContent('true');
  });

  it('keeps a user pause when the same video is activated again', () => {
    render(
      <VideoPlaybackProvider>
        <Harness />
      </VideoPlaybackProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'activate-fullscreen' }));
    fireEvent.click(screen.getByRole('button', { name: 'pause-fullscreen' }));
    fireEvent.click(screen.getByRole('button', { name: 'reactivate-fullscreen' }));

    expect(screen.getByTestId('user-paused-video-id')).toHaveTextContent('fullscreen:video-1');
  });

  it('clears a user pause when its player unregisters', () => {
    render(
      <VideoPlaybackProvider>
        <Harness />
      </VideoPlaybackProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'pause-fullscreen' }));
    fireEvent.click(screen.getByRole('button', { name: 'unregister-fullscreen' }));

    expect(screen.getByTestId('user-paused-video-id')).toBeEmptyDOMElement();
  });

  it('clears a user pause when another video becomes active', () => {
    render(
      <VideoPlaybackProvider>
        <Harness />
      </VideoPlaybackProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'activate-fullscreen' }));
    fireEvent.click(screen.getByRole('button', { name: 'pause-fullscreen' }));
    expect(screen.getByTestId('user-paused-video-id')).toHaveTextContent('fullscreen:video-1');

    fireEvent.click(screen.getByRole('button', { name: 'inline-visible' }));
    act(() => vi.advanceTimersByTime(150));

    expect(screen.getByTestId('active-video-id')).toHaveTextContent('video-1');
    expect(screen.getByTestId('user-paused-video-id')).toBeEmptyDOMElement();
  });
});
