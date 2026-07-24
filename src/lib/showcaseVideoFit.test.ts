// ABOUTME: Tests for reel video object-fit selection
// ABOUTME: Classic square videos must letterbox, not crop

import { describe, it, expect } from 'vitest';
import { parseAspectRatio, pickObjectFit } from './showcaseVideoFit';

describe('parseAspectRatio', () => {
  it('parses WxH dimensions', () => {
    expect(parseAspectRatio('480x480')).toBe(1);
    expect(parseAspectRatio('1080x1920')).toBeCloseTo(0.5625);
    expect(parseAspectRatio('1920x1080')).toBeCloseTo(1.777, 2);
  });

  it('tolerates whitespace and uppercase X', () => {
    expect(parseAspectRatio(' 480 X 480 ')).toBe(1);
  });

  it('returns null for missing or malformed input', () => {
    expect(parseAspectRatio(undefined)).toBeNull();
    expect(parseAspectRatio('')).toBeNull();
    expect(parseAspectRatio('480')).toBeNull();
    expect(parseAspectRatio('0x480')).toBeNull();
  });
});

describe('pickObjectFit', () => {
  it('letterboxes classic square (1:1) videos to preserve aspect', () => {
    expect(pickObjectFit(1)).toBe('contain');
  });

  it('letterboxes landscape videos', () => {
    expect(pickObjectFit(16 / 9)).toBe('contain');
  });

  it('fills the frame for portrait clips', () => {
    expect(pickObjectFit(9 / 16)).toBe('cover');
    expect(pickObjectFit(9 / 19.5)).toBe('cover');
  });

  it('defaults to cover when the aspect is unknown', () => {
    expect(pickObjectFit(null)).toBe('cover');
  });
});
