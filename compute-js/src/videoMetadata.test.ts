// ABOUTME: Vitest unit tests for parseImetaTag and transformVideoApiResponse
import { describe, expect, it } from 'vitest';
import { parseImetaTag, transformVideoApiResponse } from './videoMetadata.js';

describe('parseImetaTag', () => {
  it('returns empty object when tag is null or not an imeta tag', () => {
    expect(parseImetaTag(null)).toEqual({});
    expect(parseImetaTag(['t', 'foo'])).toEqual({});
  });

  it('parses url, mime, dim, and image-dim', () => {
    const tag = ['imeta',
      'url https://media.example/video.mp4',
      'm video/mp4',
      'image https://media.example/thumb.jpg',
      'dim 720x1280',
      'image-dim 1280x720'];
    expect(parseImetaTag(tag)).toEqual({
      url: 'https://media.example/video.mp4',
      m: 'video/mp4',
      image: 'https://media.example/thumb.jpg',
      dim: '720x1280',
      'image-dim': '1280x720',
    });
  });

  it('handles values that contain spaces (joined back together)', () => {
    const tag = ['imeta', 'alt A long alt text with spaces'];
    expect(parseImetaTag(tag)).toEqual({ alt: 'A long alt text with spaces' });
  });

  it('skips entries without a value', () => {
    const tag = ['imeta', 'url', 'm video/mp4'];
    expect(parseImetaTag(tag)).toEqual({ m: 'video/mp4' });
  });
});

describe('transformVideoApiResponse', () => {
  const baseEvent = {
    id: 'abc',
    pubkey: 'def',
    kind: 34236,
    content: 'hello',
    tags: [],
  };

  it('returns null when there is no event', () => {
    expect(transformVideoApiResponse({})).toBeNull();
    expect(transformVideoApiResponse({ event: null })).toBeNull();
  });

  it('extracts videoUrl, mime, and dimensions from imeta', () => {
    const result = transformVideoApiResponse({
      event: {
        ...baseEvent,
        tags: [
          ['title', 'My Video'],
          ['imeta',
            'url https://media.example/video.mp4',
            'm video/mp4',
            'image https://media.example/thumb.jpg',
            'dim 720x1280'],
        ],
      },
      stats: {},
    });
    expect(result?.videoUrl).toBe('https://media.example/video.mp4');
    expect(result?.videoMime).toBe('video/mp4');
    expect(result?.videoWidth).toBe(720);
    expect(result?.videoHeight).toBe(1280);
    expect(result?.thumbnail).toBe('https://media.example/thumb.jpg');
    expect(result?.imageWidth).toBe(720);
    expect(result?.imageHeight).toBe(1280);
  });

  it('uses image-dim for image dimensions when present', () => {
    const result = transformVideoApiResponse({
      event: {
        ...baseEvent,
        tags: [
          ['imeta',
            'url https://media.example/video.mp4',
            'image https://media.example/thumb.jpg',
            'dim 720x1280',
            'image-dim 1200x630'],
        ],
      },
      stats: {},
    });
    expect(result?.imageWidth).toBe(1200);
    expect(result?.imageHeight).toBe(630);
  });

  it('returns sensible defaults when imeta is missing', () => {
    const result = transformVideoApiResponse({
      event: { ...baseEvent, tags: [['title', 'No imeta']] },
      stats: {},
    });
    expect(result?.videoUrl).toBeNull();
    expect(result?.videoMime).toBeNull();
    expect(result?.videoWidth).toBeNull();
    expect(result?.videoHeight).toBeNull();
    expect(result?.title).toBe('No imeta');
  });

  it('falls back to defaultOgImage when imeta has no image', () => {
    const result = transformVideoApiResponse({
      event: { ...baseEvent, tags: [['title', 'X']] },
      stats: {},
    }, { defaultOgImage: 'https://divine.video/og.png' });
    expect(result?.thumbnail).toBe('https://divine.video/og.png');
  });

  it('builds engagement-stats description when no content/summary/alt', () => {
    const result = transformVideoApiResponse({
      event: { ...baseEvent, content: '', tags: [] },
      stats: { reactions: 10, comments: 3, reposts: 2 },
    });
    expect(result?.description).toBe('10 ❤️ • 3 💬 • 2 🔁 on Divine');
  });
});
