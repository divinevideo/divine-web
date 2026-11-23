// ABOUTME: Invisible buttons over the stickers burned into a playing video's frames
// ABOUTME: Each sits on its sticker while it shows; a click opens it, a double tap still reaches the player

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { VideoLinkStickerDialog } from '@/components/VideoLinkStickerDialog';
import { cn } from '@/lib/utils';
import { getSubdomainAwareUrl } from '@/lib/subdomainLinks';
import { isVideoStickerShownAt } from '@/lib/videoStickers';
import {
  getVideoStickerAction,
  isClickableVideoSticker,
  type VideoStickerAction,
} from '@/lib/videoStickerActions';
import {
  clipRectToBox,
  stickerButtonRect,
  videoFrameRect,
  type Rect,
} from '@/lib/videoStickerLayout';
import type { ParsedVideoData, VideoSticker } from '@/types/video';

/** Two clicks this close are a double tap, as the player's own touch handling counts one. */
export const STICKER_DOUBLE_TAP_MS = 300;

type StickerVideo = Pick<ParsedVideoData, 'stickers' | 'replyRootRouteId'>;

interface VideoStickerOverlayProps {
  /** The `<video>` the stickers are burned into. */
  videoElement: HTMLVideoElement | null;
  video: StickerVideo;
  /** How the player fits the frame into the element, its CSS `object-fit`. */
  objectFit?: 'contain' | 'cover';
  /**
   * The player's double tap, such as a like. Given, a single click waits
   * `STICKER_DOUBLE_TAP_MS` before it opens the sticker, so a double tap on a
   * sticker reaches the player instead. Without, a click opens at once.
   */
  onDoubleTap?: () => void;
  /** Called before a click navigates inside the app, such as to leave a fullscreen feed. */
  onBeforeNavigate?: () => void;
  className?: string;
}

/**
 * Real, transparent `<button>`s laid over the stickers the Divine app burned
 * into a video, positioned where each stands in the frame the browser draws
 * and turned with it, while it shows. The sticker itself is not drawn again:
 * the frames already show it. Clicks anywhere else go through to the player.
 *
 * Renders nothing for a video without a sticker the web can open.
 */
export function VideoStickerOverlay(props: VideoStickerOverlayProps) {
  const stickers = useMemo(
    () => (props.video.stickers ?? []).filter(isClickableVideoSticker),
    [props.video.stickers],
  );
  if (stickers.length === 0) return null;
  return <StickerButtons {...props} stickers={stickers} />;
}

interface StickerLayout {
  /** Where the stickers can show, relative to the overlay: the frame inside the element. */
  clip: Rect;
  /** The whole frame, relative to `clip`. */
  frame: Rect;
}

function measureLayout(
  overlay: HTMLElement,
  videoElement: HTMLVideoElement,
  objectFit: 'contain' | 'cover',
): StickerLayout | null {
  const boxWidth = videoElement.clientWidth;
  const boxHeight = videoElement.clientHeight;
  const frame = videoFrameRect(
    videoElement.videoWidth,
    videoElement.videoHeight,
    boxWidth,
    boxHeight,
    objectFit,
  );
  if (!frame) return null;
  // A sticker reaching past a contained video's edge is cut there in the
  // frames, and a covered video's frame is cut at the element's edge.
  const clip = clipRectToBox(frame, boxWidth, boxHeight);
  if (clip.width <= 0 || clip.height <= 0) return null;
  const videoBox = videoElement.getBoundingClientRect();
  const overlayBox = overlay.getBoundingClientRect();
  const offsetLeft = videoBox.left - overlayBox.left;
  const offsetTop = videoBox.top - overlayBox.top;
  return {
    clip: { ...clip, left: clip.left + offsetLeft, top: clip.top + offsetTop },
    frame: { ...frame, left: frame.left - clip.left, top: frame.top - clip.top },
  };
}

function sameLayout(a: StickerLayout | null, b: StickerLayout | null): boolean {
  if (a === null || b === null) return a === b;
  const keys = ['left', 'top', 'width', 'height'] as const;
  return keys.every((key) => a.clip[key] === b.clip[key] && a.frame[key] === b.frame[key]);
}

/** Keeps the frame's rect in step with the element's size and the video's resolution. */
function useStickerLayout(
  overlayRef: RefObject<HTMLDivElement>,
  videoElement: HTMLVideoElement | null,
  objectFit: 'contain' | 'cover',
): StickerLayout | null {
  const [layout, setLayout] = useState<StickerLayout | null>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !videoElement) {
      setLayout(null);
      return;
    }
    const update = () => {
      const next = measureLayout(overlay, videoElement, objectFit);
      setLayout((previous) => (sameLayout(previous, next) ? previous : next));
    };
    update();
    const events = ['loadedmetadata', 'loadeddata', 'resize'] as const;
    events.forEach((event) => videoElement.addEventListener(event, update));
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    resizeObserver?.observe(videoElement);
    resizeObserver?.observe(overlay);
    window.addEventListener('resize', update);
    return () => {
      events.forEach((event) => videoElement.removeEventListener(event, update));
      resizeObserver?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [overlayRef, videoElement, objectFit]);

  return layout;
}

type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: { mediaTime: number }) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/**
 * The indexes of `stickers` showing at the video's position, kept in step
 * with each presented frame through `requestVideoFrameCallback`, or with
 * `timeupdate` where the browser lacks it.
 */
function useShownStickers(
  videoElement: HTMLVideoElement | null,
  stickers: readonly VideoSticker[],
): number[] {
  const hasWindows = stickers.some((s) => s.startMs !== undefined || s.endMs !== undefined);
  const shownAt = useCallback(
    (positionMs: number) =>
      stickers
        .map((sticker, index) => (isVideoStickerShownAt(sticker, positionMs) ? index : -1))
        .filter((index) => index >= 0)
        .join(','),
    [stickers],
  );
  const [shownKey, setShownKey] = useState(() =>
    shownAt(videoElement ? videoElement.currentTime * 1000 : 0),
  );

  useEffect(() => {
    if (!videoElement) {
      setShownKey(shownAt(0));
      return;
    }
    const update = (positionMs = videoElement.currentTime * 1000) => setShownKey(shownAt(positionMs));
    update();
    if (!hasWindows) return;

    const video = videoElement as FrameCallbackVideo;
    const onEvent = () => update();
    const events = ['seeked', 'loadeddata', 'play', 'emptied'];
    let handle: number | null = null;
    if (typeof video.requestVideoFrameCallback === 'function') {
      const onFrame = (_now: number, metadata: { mediaTime: number }) => {
        update(metadata.mediaTime * 1000);
        handle = video.requestVideoFrameCallback!(onFrame);
      };
      handle = video.requestVideoFrameCallback(onFrame);
    } else {
      events.push('timeupdate');
    }
    events.forEach((event) => video.addEventListener(event, onEvent));
    return () => {
      events.forEach((event) => video.removeEventListener(event, onEvent));
      if (handle !== null) video.cancelVideoFrameCallback?.(handle);
    };
  }, [videoElement, hasWindows, shownAt]);

  return useMemo(() => (shownKey ? shownKey.split(',').map(Number) : []), [shownKey]);
}

/** The first line of a sticker's text, unless it only repeats what the button names. */
function visibleText(sticker: VideoSticker): string | undefined {
  const text = sticker.label?.split('\n')[0]?.trim();
  if (!text) return undefined;
  if (sticker.kind === 'hashtag' && text.replace(/^#/, '').toLowerCase() === sticker.target) {
    return undefined;
  }
  return text;
}

function StickerButtons({
  videoElement,
  video,
  stickers,
  objectFit = 'contain',
  onDoubleTap,
  onBeforeNavigate,
  className,
}: VideoStickerOverlayProps & { stickers: VideoSticker[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const overlayRef = useRef<HTMLDivElement>(null);
  const layout = useStickerLayout(overlayRef, videoElement, objectFit);
  const shown = useShownStickers(videoElement, stickers);
  const lastTapRef = useRef<{ time: number; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const [linkToConfirm, setLinkToConfirm] = useState<string | null>(null);

  useEffect(() => () => {
    if (lastTapRef.current?.timer) clearTimeout(lastTapRef.current.timer);
  }, []);

  const runAction = useCallback((action: VideoStickerAction) => {
    if (action.type === 'external') {
      window.open(action.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (action.type === 'confirmExternal') {
      setLinkToConfirm(action.url);
      return;
    }
    const { href, isExternal } = getSubdomainAwareUrl(action.path, action.ownerPubkey);
    onBeforeNavigate?.();
    if (isExternal) {
      window.location.assign(href);
    } else {
      navigate(href);
    }
  }, [navigate, onBeforeNavigate]);

  const handleClick = useCallback((sticker: VideoSticker, event: MouseEvent<HTMLButtonElement>) => {
    // The click is the sticker's: it neither pauses the video nor reaches the card.
    event.stopPropagation();
    const action = getVideoStickerAction(sticker, video);
    if (!action) return;

    // Enter or Space: nobody double-taps a key.
    if (event.detail === 0) {
      runAction(action);
      return;
    }

    const now = Date.now();
    const last = lastTapRef.current;
    if (last && now - last.time < STICKER_DOUBLE_TAP_MS) {
      // The second tap of a double tap belongs to the player, and never opens twice.
      if (last.timer) clearTimeout(last.timer);
      lastTapRef.current = null;
      onDoubleTap?.();
      return;
    }

    if (onDoubleTap) {
      const timer = setTimeout(() => {
        lastTapRef.current = null;
        runAction(action);
      }, STICKER_DOUBLE_TAP_MS);
      lastTapRef.current = { time: now, timer };
    } else {
      lastTapRef.current = { time: now };
      runAction(action);
    }
  }, [video, onDoubleTap, runAction]);

  const labelOf = (sticker: VideoSticker): string => {
    const action = (() => {
      switch (sticker.kind) {
        case 'link':
          return t('videoStickers.link', { url: sticker.target });
        case 'mention':
          return t('videoStickers.mention');
        case 'hashtag':
          return t('videoStickers.hashtag', { hashtag: sticker.target });
        case 'place':
          return t('videoStickers.place', { place: sticker.target });
        case 'reply':
          return t('videoStickers.reply');
        default:
          return '';
      }
    })();
    const text = visibleText(sticker);
    // The words on the sticker come first, so a voice command can name it.
    return text ? t('videoStickers.labeled', { label: text, action }) : action;
  };

  return (
    <div
      ref={overlayRef}
      className={cn('pointer-events-none absolute inset-0 z-[15]', className)}
      data-testid="video-sticker-overlay"
    >
      {layout && shown.length > 0 && (
        <div
          className="absolute overflow-hidden"
          style={{
            left: layout.clip.left,
            top: layout.clip.top,
            width: layout.clip.width,
            height: layout.clip.height,
          }}
        >
          {shown.map((index) => {
            const sticker = stickers[index];
            const box = stickerButtonRect(sticker, layout.frame);
            const label = labelOf(sticker);
            return (
              <button
                key={index}
                type="button"
                data-video-sticker={sticker.kind}
                aria-label={label}
                title={label}
                className={cn(
                  'pointer-events-auto absolute cursor-pointer touch-manipulation rounded-lg border-0 bg-transparent p-0',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                )}
                style={{
                  left: layout.frame.left + box.left,
                  top: layout.frame.top + box.top,
                  width: box.width,
                  height: box.height,
                  transform: sticker.rotationDegrees ? `rotate(${sticker.rotationDegrees}deg)` : undefined,
                }}
                onClick={(event) => handleClick(sticker, event)}
              />
            );
          })}
        </div>
      )}
      <VideoLinkStickerDialog url={linkToConfirm} onClose={() => setLinkToConfirm(null)} />
    </div>
  );
}
