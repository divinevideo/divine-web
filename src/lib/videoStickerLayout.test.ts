// ABOUTME: Tests where a video's frame is drawn inside its element for object-fit contain and cover
// ABOUTME: and where a sticker's button lands on that frame

import { describe, expect, it } from 'vitest';
import { clipRectToBox, stickerButtonRect, videoFrameRect } from './videoStickerLayout';

describe('videoFrameRect', () => {
  describe('contain', () => {
    it('letterboxes a portrait video in a landscape box', () => {
      // 1080×1920 into 1000×500: as tall as the box, centred across it.
      expect(videoFrameRect(1080, 1920, 1000, 500, 'contain')).toEqual({
        left: (1000 - 281.25) / 2,
        top: 0,
        width: 281.25,
        height: 500,
      });
    });

    it('pillarboxes a landscape video in a portrait box', () => {
      // 1920×1080 into 400×800: as wide as the box, centred down it.
      expect(videoFrameRect(1920, 1080, 400, 800, 'contain')).toEqual({
        left: 0,
        top: (800 - 225) / 2,
        width: 400,
        height: 225,
      });
    });

    it('fills a box of the same shape exactly', () => {
      expect(videoFrameRect(1080, 1920, 270, 480, 'contain')).toEqual({ left: 0, top: 0, width: 270, height: 480 });
    });
  });

  describe('cover', () => {
    it('crops a portrait video in a landscape box at top and bottom', () => {
      expect(videoFrameRect(1080, 1920, 1000, 500, 'cover')).toEqual({
        left: 0,
        top: (500 - 1000 * 1920 / 1080) / 2,
        width: 1000,
        height: 1000 * 1920 / 1080,
      });
    });

    it('crops a landscape video in a portrait box at the sides', () => {
      expect(videoFrameRect(1920, 1080, 400, 800, 'cover')).toEqual({
        left: (400 - 800 * 1920 / 1080) / 2,
        top: 0,
        width: 800 * 1920 / 1080,
        height: 800,
      });
    });

    it('crops a square video in a portrait box, as the browser does', () => {
      expect(videoFrameRect(480, 480, 300, 600, 'cover')).toEqual({ left: -150, top: 0, width: 600, height: 600 });
    });
  });

  it('is null until the video and the box have a size', () => {
    expect(videoFrameRect(0, 0, 400, 800, 'contain')).toBeNull();
    expect(videoFrameRect(1080, 1920, 0, 800, 'cover')).toBeNull();
    expect(videoFrameRect(Number.NaN, 1920, 400, 800, 'contain')).toBeNull();
  });
});

describe('clipRectToBox', () => {
  it('keeps a contained frame whole', () => {
    expect(clipRectToBox({ left: 359.375, top: 0, width: 281.25, height: 500 }, 1000, 500))
      .toEqual({ left: 359.375, top: 0, width: 281.25, height: 500 });
  });

  it('cuts a covering frame at the box', () => {
    expect(clipRectToBox({ left: -150, top: 0, width: 600, height: 600 }, 300, 600))
      .toEqual({ left: 0, top: 0, width: 300, height: 600 });
  });
});

describe('stickerButtonRect', () => {
  it('places the sticker by its centre and size as fractions of the frame', () => {
    expect(stickerButtonRect({ centerX: 0.5, centerY: 0.25, width: 0.4, height: 0.1 }, { width: 400, height: 800 }))
      .toEqual({ left: 120, top: 160, width: 160, height: 80 });
  });

  it('grows a small sticker around its centre to a size a finger can hit', () => {
    expect(stickerButtonRect({ centerX: 0.5, centerY: 0.5, width: 0.05, height: 0.02 }, { width: 400, height: 800 }))
      .toEqual({ left: 176, top: 376, width: 48, height: 48 });
  });
});
