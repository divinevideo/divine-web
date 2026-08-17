import { describe, expect, it } from 'vitest';

import {
  parseFeaturedTabPillLabel,
  parseFeaturedTabSlug,
  parseFeaturedTabSponsorName,
  pickFeaturedTabLabel,
  transformFeaturedTabVideosResponse,
} from './featuredTabsTransform';

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

  it('rejects slugs that would shadow built-in discovery tabs', () => {
    expect(parseFeaturedTabSlug('foryou')).toBeNull();
    expect(parseFeaturedTabSlug('classics')).toBeNull();
    expect(parseFeaturedTabSlug('hot')).toBeNull();
    expect(parseFeaturedTabSlug('hashtags')).toBeNull();
    expect(parseFeaturedTabSlug('top')).toBeNull();
  });

  it('accepts routable featured tab slugs', () => {
    expect(parseFeaturedTabSlug('seasonal-theme')).toBe('seasonal-theme');
  });

  it('only accepts string pill labels and keeps them readable', () => {
    expect(parseFeaturedTabPillLabel({ text: 'Launch' })).toBeNull();
    expect(parseFeaturedTabPillLabel(' Skate week ')).toBe('Skate week');
    expect(parseFeaturedTabPillLabel('This pill label is unexpectedly long'))
      .toBe('This pill label is unexp');
  });

  it('only accepts string sponsor names and keeps them readable', () => {
    expect(parseFeaturedTabSponsorName({ text: 'Acme Bikes' })).toBeNull();
    expect(parseFeaturedTabSponsorName(' Acme Bikes ')).toBe('Acme Bikes');
    expect(parseFeaturedTabSponsorName('')).toBeNull();
    expect(parseFeaturedTabSponsorName('This sponsor name is unexpectedly long'))
      .toBe('This sponsor name is une');
  });

  it('strips invisible formatting from server-supplied strings', () => {
    // A bidi override could otherwise reorder the tab bar around the label.
    expect(pickFeaturedTabLabel({ default: 'Sea\u202esonal' }, 'en')).toBe('Seasonal');
    expect(parseFeaturedTabPillLabel('Ska\u200bte')).toBe('Skate');
    expect(parseFeaturedTabSponsorName('Acme\u200b Bikes')).toBe('Acme Bikes');
    expect(parseFeaturedTabSponsorName('\u200b\u202e')).toBeNull();
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

  it('treats a malformed pagination envelope as the last page', () => {
    expect(transformFeaturedTabVideosResponse({ data: [] } as never))
      .toEqual({ videos: [], next_cursor: undefined, has_more: false });

    expect(transformFeaturedTabVideosResponse({
      data: [],
      pagination: { has_more: true },
    })).toEqual({ videos: [], next_cursor: undefined, has_more: false });
  });
});
