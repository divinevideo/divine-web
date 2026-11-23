// ABOUTME: Vitest unit tests for parseImetaTag and transformVideoApiResponse
import { describe, expect, it } from 'vitest';
import {
  isAddressableVideoRouteId,
  linkPreviewVideoUrl,
  parseImetaTag,
  progressive720pUrl,
  transformVideoApiResponse,
} from './videoMetadata.js';

describe('isAddressableVideoRouteId', () => {
  const pubkey = 'a'.repeat(64);
  const dTag = 'c'.repeat(64);

  it('recognises the kind:pubkey:d route id the app writes for an author-named video', () => {
    expect(isAddressableVideoRouteId(`34236:${pubkey}:${dTag}`)).toBe(true);
    expect(isAddressableVideoRouteId(`34236:${pubkey.toUpperCase()}:folder%2Fclip`)).toBe(true);
  });

  it('recognises it when the separators arrive percent-encoded', () => {
    expect(isAddressableVideoRouteId(`34236%3A${pubkey}%3A${dTag}`)).toBe(true);
  });

  it('recognises it with an empty d tag or one that starts with a line break', () => {
    expect(isAddressableVideoRouteId(`34236:${pubkey}:`)).toBe(true);
    expect(isAddressableVideoRouteId(`34236:${pubkey}:%0Aclip`)).toBe(true);
  });

  it.each([
    ['an event id', 'e'.repeat(64)],
    ['a d tag', dTag],
    ['a legacy vine id', 'hBFP5LFKUOU'],
    ['a short-pubkey look-alike', `34236:abc:${dTag}`],
    ['a malformed escape', '%E0%A4%A'],
  ])('leaves %s to the normal lookup', (_label, id) => {
    expect(isAddressableVideoRouteId(id)).toBe(false);
  });
});

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

  it('returns visible video-page stats and author avatar from the direct video API shape', () => {
    const result = transformVideoApiResponse({
      event: {
        ...baseEvent,
        tags: [
          ['title', 'Classic loop'],
          ['loops', '296,752'],
        ],
      },
      stats: {
        reactions: 10,
        comments: 3,
        reposts: 2,
        embedded_loops: 123456,
        author_name: 'Alice',
        author_avatar: 'https://example.com/avatar.jpg',
      },
    });

    expect(result).toMatchObject({
      authorName: 'Alice',
      authorAvatar: 'https://example.com/avatar.jpg',
      reactions: 10,
      comments: 3,
      reposts: 2,
      loops: 123456,
    });
  });

  it('falls back to loop tags when embedded loop stats are absent', () => {
    const result = transformVideoApiResponse({
      event: {
        ...baseEvent,
        tags: [['loop_count', '42']],
      },
      stats: {},
    });

    expect(result?.loops).toBe(42);
  });

  it('uses the origin tag external id for Vine alternate links', () => {
    const result = transformVideoApiResponse({
      event: {
        ...baseEvent,
        tags: [['origin', 'vine', 'origin-id', 'https://vine.co/v/origin-id']],
      },
      stats: {},
    });

    expect(result?.originExternalId).toBe('origin-id');
  });

  it('falls back to the d tag for legacy platform Vine events', () => {
    const result = transformVideoApiResponse({
      event: {
        ...baseEvent,
        tags: [
          ['platform', 'vine'],
          ['d', 'legacy-d-id'],
        ],
      },
      stats: {},
    });

    expect(result?.originExternalId).toBe('legacy-d-id');
  });

  it('does not set originExternalId for non-Vine events', () => {
    const result = transformVideoApiResponse({
      event: {
        ...baseEvent,
        tags: [['origin', 'youtube', 'external-id']],
      },
      stats: {},
    });

    expect(result?.originExternalId).toBeNull();
  });

  it('preserves event created_at and age_restricted flag for VideoObject and gating', () => {
    const result = transformVideoApiResponse({
      event: {
        ...baseEvent,
        created_at: 1700000123,
      },
      stats: {
        age_restricted: true,
      },
    });

    expect(result?.created_at).toBe(1700000123);
    expect(result?.age_restricted).toBe(true);
  });
});

describe('progressive720pUrl', () => {
  const hash = 'b'.repeat(64);

  it('returns the 720p MP4 of an original Divine blob', () => {
    expect(progressive720pUrl(`https://media.divine.video/${hash}`))
      .toBe(`https://media.divine.video/${hash}/720p.mp4`);
    expect(progressive720pUrl(`https://media.divine.video/${hash}.mp4`))
      .toBe(`https://media.divine.video/${hash}/720p.mp4`);
  });

  it('returns null for other hosts, renditions and non-hash paths', () => {
    expect(progressive720pUrl(`https://cdn.example.com/${hash}`)).toBeNull();
    expect(progressive720pUrl(`https://media.divine.video/${hash}/480p.mp4`)).toBeNull();
    expect(progressive720pUrl('https://media.divine.video/x.mp4')).toBeNull();
    expect(progressive720pUrl(null)).toBeNull();
  });
});

describe('linkPreviewVideoUrl', () => {
  const original = `https://media.divine.video/${'c'.repeat(64)}`;
  const now = 2_000_000_000;

  it('uses the 720p MP4 once the video is more than an hour old', () => {
    expect(linkPreviewVideoUrl({ videoUrl: original, created_at: now - 7200, isClassicVine: false }, now))
      .toBe(`${original}/720p.mp4`);
  });

  it('keeps the original while the rendition may still be in the queue', () => {
    expect(linkPreviewVideoUrl({ videoUrl: original, created_at: now - 600, isClassicVine: false }, now))
      .toBe(original);
  });

  it('keeps the original for classic Vines and unknown publish times', () => {
    expect(linkPreviewVideoUrl({ videoUrl: original, created_at: now - 7200, isClassicVine: true }, now))
      .toBe(original);
    expect(linkPreviewVideoUrl({ videoUrl: original, created_at: null, isClassicVine: false }, now))
      .toBe(original);
  });

  it('returns null without a video', () => {
    expect(linkPreviewVideoUrl(null, now)).toBeNull();
  });
});

describe('transformVideoApiResponse classic Vine flag', () => {
  const eventWith = (tags: string[][]) => ({ event: { content: '', tags: [['d', 'x'], ...tags] } });

  it('marks events with an origin or platform tag naming Vine', () => {
    expect(transformVideoApiResponse(eventWith([['origin', 'vine']]))?.isClassicVine).toBe(true);
    expect(transformVideoApiResponse(eventWith([['platform', 'Vine']]))?.isClassicVine).toBe(true);
  });

  it('does not mark other events', () => {
    expect(transformVideoApiResponse(eventWith([['origin', 'tiktok', 'abc']]))?.isClassicVine).toBe(false);
  });
});
