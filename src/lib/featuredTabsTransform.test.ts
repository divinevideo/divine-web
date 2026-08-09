import { describe, expect, it } from 'vitest';

import { parseFeaturedTabDisclosure, parseFeaturedTabPosition, pickFeaturedTabLabel, transformFeaturedTabVideosResponse } from './featuredTabsTransform';

describe('featured tab transforms', () => {
  it('picks a locale label and falls back to default with a length cap', () => {
    expect(pickFeaturedTabLabel({
      default: 'Seasonal Theme',
      es: 'Tema',
    }, 'es-MX')).toBe('Tema');

    expect(pickFeaturedTabLabel({
      default: 'This label is unexpectedly long and should be trimmed',
    }, 'fr')).toBe('This label is unexpected');
  });

  it('rejects hostile position payloads and unknown tab names', () => {
    expect(parseFeaturedTabPosition('after-hot')).toBeNull();
    expect(parseFeaturedTabPosition({ web: { after: 'rising' } })).toBeNull();
    expect(parseFeaturedTabPosition({ mobile: { after: 'popular' } })).toBeNull();
  });

  it('parses valid web position by tab name', () => {
    expect(parseFeaturedTabPosition({ web: { after: 'hot' } })).toEqual({ after: 'hot' });
    expect(parseFeaturedTabPosition({ web: { before: 'hashtags' } })).toEqual({ before: 'hashtags' });
  });

  it('only accepts string disclosure labels', () => {
    expect(parseFeaturedTabDisclosure({ text: 'Ad' })).toBeNull();
    expect(parseFeaturedTabDisclosure(' Sponsored collection ')).toBe('Sponsored collec');
  });

  it('maps featured video envelopes without reordering server data', () => {
    const response = transformFeaturedTabVideosResponse({
      data: [
        {
          id: 'video-2',
          pubkey: 'pubkey-2',
          created_at: '2026-08-08T00:00:00Z',
          kind: 34236,
          d_tag: 'two',
          title: 'Two',
          video_url: 'https://media.example/two.mp4',
        },
        {
          id: 'video-1',
          pubkey: 'pubkey-1',
          created_at: '2026-08-07T00:00:00Z',
          kind: 34236,
          d_tag: 'one',
          title: 'One',
          video_url: 'https://media.example/one.mp4',
        },
      ],
      pagination: {
        next_cursor: 'cursor-2',
        has_more: true,
      },
    });

    expect(response.videos.map((video) => video.id)).toEqual(['video-2', 'video-1']);
    expect(response.videos[0].created_at).toBe(1786147200);
    expect(response.next_cursor).toBe('cursor-2');
    expect(response.has_more).toBe(true);
  });
});
