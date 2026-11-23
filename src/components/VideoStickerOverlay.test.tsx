// ABOUTME: Tests the invisible sticker buttons over a playing video: when they show, where they sit,
// ABOUTME: what a click on each kind opens, and that a double tap still reaches the player

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import { initializeI18n } from '@/lib/i18n';
import type { VideoSticker } from '@/types/video';
import { STICKER_DOUBLE_TAP_MS, VideoStickerOverlay } from './VideoStickerOverlay';

const PUBKEY = 'a'.repeat(64);
const EVENT_ID = 'e'.repeat(64);

function sticker(overrides: Partial<VideoSticker>): VideoSticker {
  return {
    kind: 'hashtag',
    target: 'summer',
    centerX: 0.5,
    centerY: 0.5,
    width: 0.5,
    height: 0.1,
    rotationDegrees: 0,
    audience: 'everyone',
    ...overrides,
  };
}

interface FakeVideo {
  element: HTMLVideoElement;
  setTime: (seconds: number) => void;
}

/** A `<video>` of `videoWidth`×`videoHeight` drawn in an element of `width`×`height`. */
function fakeVideo({ videoWidth = 1080, videoHeight = 1920, width = 1000, height = 500 } = {}): FakeVideo {
  const element = document.createElement('video');
  let currentTime = 0;
  Object.defineProperties(element, {
    videoWidth: { configurable: true, get: () => videoWidth },
    videoHeight: { configurable: true, get: () => videoHeight },
    clientWidth: { configurable: true, get: () => width },
    clientHeight: { configurable: true, get: () => height },
    currentTime: { configurable: true, get: () => currentTime, set: (value: number) => { currentTime = value; } },
  });
  return {
    element,
    setTime: (seconds) => {
      currentTime = seconds;
      act(() => {
        element.dispatchEvent(new Event('timeupdate'));
      });
    },
  };
}

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderOverlay(
  stickers: VideoSticker[],
  {
    video = fakeVideo(),
    replyRootRouteId,
    objectFit,
    onDoubleTap,
    onBeforeNavigate,
    onParentClick,
  }: {
    video?: FakeVideo;
    replyRootRouteId?: string;
    objectFit?: 'contain' | 'cover';
    onDoubleTap?: () => void;
    onBeforeNavigate?: () => void;
    onParentClick?: () => void;
  } = {},
) {
  const result = render(
    <MemoryRouter initialEntries={['/video/current']}>
      <div onClick={onParentClick}>
        <VideoStickerOverlay
          videoElement={video.element}
          video={{ stickers, replyRootRouteId }}
          objectFit={objectFit}
          onDoubleTap={onDoubleTap}
          onBeforeNavigate={onBeforeNavigate}
        />
      </div>
      <LocationProbe />
    </MemoryRouter>,
  );
  return { ...result, video };
}

/** A mouse click, which counts clicks; a bare `fireEvent.click` is a keyboard one. */
function tap(element: Element) {
  fireEvent.click(element, { detail: 1 });
}

describe('VideoStickerOverlay', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await initializeI18n({ force: true, languages: ['en-US'] });
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
    vi.useRealTimers();
  });

  it('renders nothing for a video with no sticker the web opens', () => {
    const { container } = renderOverlay([
      sticker({ kind: 'countdown', target: '1782064800' }),
      sticker({ kind: 'poll', target: EVENT_ID, label: 'Q?\nA\nB' }),
      sticker({ kind: 'sound', target: '' }),
      sticker({ kind: 'question', target: '', label: 'Ask me' }),
    ]);

    expect(container.querySelector('[data-testid="video-sticker-overlay"]')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('shows no button until the video has a size', () => {
    renderOverlay([sticker({})], { video: fakeVideo({ videoWidth: 0, videoHeight: 0 }) });

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('shows each button only inside its time window', () => {
    const { video } = renderOverlay([
      sticker({ target: 'always' }),
      sticker({ target: 'early', endMs: 1000 }),
      sticker({ target: 'late', startMs: 2000, endMs: 3000 }),
    ]);

    const shown = () => screen.queryAllByRole('button').map((button) => button.getAttribute('aria-label'));

    expect(shown()).toEqual(['Hashtag sticker, opens #always', 'Hashtag sticker, opens #early']);

    video.setTime(1);
    expect(shown()).toEqual(['Hashtag sticker, opens #always']);

    video.setTime(2.5);
    expect(shown()).toEqual(['Hashtag sticker, opens #always', 'Hashtag sticker, opens #late']);

    video.setTime(3);
    expect(shown()).toEqual(['Hashtag sticker, opens #always']);
  });

  it('follows each presented frame where the browser offers requestVideoFrameCallback', () => {
    const video = fakeVideo();
    let pending: ((now: number, metadata: { mediaTime: number }) => void) | null = null;
    const cancel = vi.fn();
    Object.assign(video.element, {
      requestVideoFrameCallback: (callback: typeof pending) => {
        pending = callback;
        return 7;
      },
      cancelVideoFrameCallback: cancel,
    });
    const { unmount } = renderOverlay([sticker({ startMs: 500 })], { video });

    expect(screen.queryAllByRole('button')).toHaveLength(0);

    act(() => pending?.(0, { mediaTime: 0.5 }));
    expect(screen.getAllByRole('button')).toHaveLength(1);

    unmount();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it('places a button over its sticker in a contained portrait video', () => {
    // 1080×1920 contained in 1000×500: the frame is 281.25×500, centred.
    renderOverlay([sticker({ centerX: 0.5, centerY: 0.25, width: 0.8, height: 0.2, rotationDegrees: -15 })]);

    const button = screen.getByRole('button');
    const clip = button.parentElement!;
    expect(clip.style.left).toBe('359.375px');
    expect(clip.style.top).toBe('0px');
    expect(clip.style.width).toBe('281.25px');
    expect(clip.style.height).toBe('500px');
    expect(button.style.left).toBe('28.125px');
    expect(button.style.top).toBe('75px');
    expect(button.style.width).toBe('225px');
    expect(button.style.height).toBe('100px');
    expect(button.style.transform).toBe('rotate(-15deg)');
  });

  it('clips a covering landscape video to its element and places the button on the whole frame', () => {
    // 1920×1080 covering 400×800: the frame is 1422.2×800, cut to the element.
    renderOverlay([sticker({ centerX: 0.5, centerY: 0.5, width: 0.1, height: 0.1 })], {
      video: fakeVideo({ videoWidth: 1920, videoHeight: 1080, width: 400, height: 800 }),
      objectFit: 'cover',
    });

    const button = screen.getByRole('button');
    const clip = button.parentElement!;
    expect(clip.style.left).toBe('0px');
    expect(clip.style.width).toBe('400px');
    expect(clip.style.height).toBe('800px');
    const frameWidth = 800 * 1920 / 1080;
    expect(parseFloat(button.style.left)).toBeCloseTo((400 - frameWidth) / 2 + frameWidth * 0.45, 6);
    expect(button.style.top).toBe('360px');
    expect(button.style.transform).toBe('');
  });

  it('names each button by what the sticker shows and what it opens', () => {
    renderOverlay([
      sticker({ kind: 'link', target: 'https://example.com/a', label: 'example.com' }),
      sticker({ kind: 'mention', target: PUBKEY, label: 'Alex' }),
      sticker({ kind: 'hashtag', target: 'summer', label: 'Summer' }),
      sticker({ kind: 'place', target: 'Zermatt, Wallis, Schweiz', label: 'Zermatt' }),
      sticker({ kind: 'reply', target: EVENT_ID, label: 'Sam\nNice one' }),
    ]);

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'example.com: Link sticker, opens https://example.com/a',
      'Alex: Mention sticker, opens the profile',
      'Hashtag sticker, opens #summer',
      'Zermatt: Location sticker, opens Zermatt, Wallis, Schweiz in a map',
      'Sam: Reply sticker, opens what this video replies to',
    ]);
    for (const button of buttons) {
      expect(button).toHaveAttribute('type', 'button');
      expect(button.className).toContain('cursor-pointer');
      expect(button.className).toContain('focus-visible:ring-2');
      expect(button.title).toBe(button.getAttribute('aria-label'));
    }
  });

  it('opens a link in a new tab without opener or referrer', () => {
    renderOverlay([sticker({ kind: 'link', target: 'https://example.com/a' })]);

    tap(screen.getByRole('button'));

    expect(openSpy).toHaveBeenCalledWith('https://example.com/a', '_blank', 'noopener,noreferrer');
    expect(screen.getByTestId('location')).toHaveTextContent('/video/current');
  });

  it('opens a place in an OpenStreetMap search in a new tab', () => {
    renderOverlay([sticker({ kind: 'place', target: 'Zermatt, Wallis, Schweiz' })]);

    tap(screen.getByRole('button'));

    expect(openSpy).toHaveBeenCalledWith(
      'https://www.openstreetmap.org/search?query=Zermatt%2C+Wallis%2C+Schweiz',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('goes to the profile of a mention', () => {
    renderOverlay([sticker({ kind: 'mention', target: PUBKEY })]);

    tap(screen.getByRole('button'));

    expect(screen.getByTestId('location')).toHaveTextContent(`/profile/${nip19.npubEncode(PUBKEY)}`);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('goes to the feed of a hashtag', () => {
    renderOverlay([sticker({ kind: 'hashtag', target: 'summer' })]);

    tap(screen.getByRole('button'));

    expect(screen.getByTestId('location')).toHaveTextContent('/hashtag/summer');
  });

  it('goes to the video a reply replies to', () => {
    const root = `34236:${PUBKEY}:root-video`;
    renderOverlay([sticker({ kind: 'reply', target: EVENT_ID })], { replyRootRouteId: root });

    tap(screen.getByRole('button'));

    expect(screen.getByTestId('location')).toHaveTextContent(`/video/${root}`);
  });

  it('lets the parent close before navigating', () => {
    const onBeforeNavigate = vi.fn();
    renderOverlay([sticker({ kind: 'hashtag', target: 'summer' })], { onBeforeNavigate });

    tap(screen.getByRole('button'));

    expect(onBeforeNavigate).toHaveBeenCalledTimes(1);
  });

  it('keeps the click from the player and the card around it', () => {
    const onParentClick = vi.fn();
    renderOverlay([sticker({ kind: 'link', target: 'https://example.com/' })], { onParentClick });

    tap(screen.getByRole('button'));

    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('opens once for a double click when the player has no double tap', () => {
    renderOverlay([sticker({ kind: 'link', target: 'https://example.com/' })]);
    const button = screen.getByRole('button');

    tap(button);
    tap(button);

    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  describe('with a player that likes on a double tap', () => {
    it('opens a single click once a double tap can no longer follow', () => {
      vi.useFakeTimers();
      const onDoubleTap = vi.fn();
      renderOverlay([sticker({ kind: 'link', target: 'https://example.com/' })], { onDoubleTap });

      tap(screen.getByRole('button'));
      expect(openSpy).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(STICKER_DOUBLE_TAP_MS));
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(onDoubleTap).not.toHaveBeenCalled();
    });

    it('likes on a double tap over a sticker and opens nothing', () => {
      vi.useFakeTimers();
      const onDoubleTap = vi.fn();
      renderOverlay([sticker({ kind: 'hashtag', target: 'summer' })], { onDoubleTap });
      const button = screen.getByRole('button');

      tap(button);
      act(() => vi.advanceTimersByTime(STICKER_DOUBLE_TAP_MS - 100));
      tap(button);
      act(() => vi.advanceTimersByTime(STICKER_DOUBLE_TAP_MS * 2));

      expect(onDoubleTap).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('location')).toHaveTextContent('/video/current');
    });

    it('opens at once from the keyboard', () => {
      const onDoubleTap = vi.fn();
      renderOverlay([sticker({ kind: 'link', target: 'https://example.com/' })], { onDoubleTap });

      // Enter or Space on a button fires a click that counts no clicks.
      fireEvent.click(screen.getByRole('button'), { detail: 0 });

      expect(openSpy).toHaveBeenCalledTimes(1);
    });
  });
});
