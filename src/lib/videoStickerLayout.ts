// ABOUTME: Maps a video sticker's normalized area onto the rect the video is drawn in
// ABOUTME: Pure geometry for VideoStickerOverlay, mirroring the app's videoFrameRect

import type { VideoSticker } from '@/types/video';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The smallest a sticker's button gets, so a finger or cursor can hit it. */
export const MIN_STICKER_HIT_SIZE = 48;

/**
 * The rect a video of `videoWidth` × `videoHeight` pixels is drawn in, inside
 * an element of `boxWidth` × `boxHeight`, the way CSS `object-fit` places it:
 * `contain` fits the whole frame inside the box, `cover` fills the box and
 * crops what reaches past it. Both keep the frame centred. Null until the
 * video and the box have a size.
 */
export function videoFrameRect(
  videoWidth: number,
  videoHeight: number,
  boxWidth: number,
  boxHeight: number,
  objectFit: 'contain' | 'cover',
): Rect | null {
  if (!(videoWidth > 0 && videoHeight > 0 && boxWidth > 0 && boxHeight > 0)) return null;
  const aspectRatio = videoWidth / videoHeight;
  // Covering, the frame is as tall as it must be to reach every side of the
  // box; contained, as tall as it may be to stay inside them.
  const height = objectFit === 'cover'
    ? Math.max(boxWidth / aspectRatio, boxHeight)
    : Math.min(boxWidth / aspectRatio, boxHeight);
  const width = height * aspectRatio;
  return {
    left: (boxWidth - width) / 2,
    top: (boxHeight - height) / 2,
    width,
    height,
  };
}

/** The part of `rect` inside a box of `boxWidth` × `boxHeight` at the origin. */
export function clipRectToBox(rect: Rect, boxWidth: number, boxHeight: number): Rect {
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.left + rect.width, boxWidth);
  const bottom = Math.min(rect.top + rect.height, boxHeight);
  return {
    left,
    top,
    width: Math.max(right - left, 0),
    height: Math.max(bottom - top, 0),
  };
}

/**
 * Where a sticker's button goes, relative to `frame`'s top-left, before it is
 * turned around its centre: the sticker's own area, grown to
 * `MIN_STICKER_HIT_SIZE` on a side that is smaller, as the app grows it.
 */
export function stickerButtonRect(
  sticker: Pick<VideoSticker, 'centerX' | 'centerY' | 'width' | 'height'>,
  frame: Pick<Rect, 'width' | 'height'>,
  minSize = MIN_STICKER_HIT_SIZE,
): Rect {
  const centerX = sticker.centerX * frame.width;
  const centerY = sticker.centerY * frame.height;
  const width = Math.max(sticker.width * frame.width, minSize);
  const height = Math.max(sticker.height * frame.height, minSize);
  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    width,
    height,
  };
}
