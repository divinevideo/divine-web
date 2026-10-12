import { describe, expect, it } from 'vitest';

import {
  parseFeaturedTabEmoji,
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

  describe('parseFeaturedTabEmoji', () => {
    it.each([
      ['sparkles', '\u2728'],
      ['party popper', '\u{1F389}'],
      ['star without a presentation selector', '\u2B50'],
      ['heart with VS16', '\u2764\uFE0F'],
      ['thumbs up with a skin tone', '\u{1F44D}\u{1F3FD}'],
      ['ZWJ sequence', '\u{1F469}\u200D\u{1F4BB}'],
      ['rainbow flag', '\u{1F3F3}\uFE0F\u200D\u{1F308}'],
      ['regional indicator flag', '\u{1F1FA}\u{1F1F8}'],
      ['tag sequence flag', '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}'],
    ])('accepts a single emoji: %s', (_name, emoji) => {
      expect(parseFeaturedTabEmoji(emoji)).toBe(emoji);
    });

    it('trims surrounding whitespace', () => {
      expect(parseFeaturedTabEmoji('  \u2728\n')).toBe('\u2728');
    });

    // Sixteen scalars is the most a real sequence needs; one more is rejected
    // by the "more than 16 scalars" case below.
    it('accepts a sequence of exactly 16 scalars', () => {
      const sixteen = '\u{1F469}\u{1F3FD}' + '\u200d\u{1F469}'.repeat(7);

      expect(Array.from(sixteen)).toHaveLength(16);
      expect(parseFeaturedTabEmoji(sixteen)).toBe(sixteen);
    });

    // Older browsers lack Intl.Segmenter. The check cannot count graphemes
    // there, so it rejects rather than guesses and the default glyph shows.
    it('rejects a valid emoji where Intl.Segmenter is unavailable', () => {
      const original = Intl.Segmenter;
      Object.defineProperty(Intl, 'Segmenter', { value: undefined, configurable: true, writable: true });
      try {
        expect(parseFeaturedTabEmoji('\u2728')).toBeNull();
      } finally {
        Object.defineProperty(Intl, 'Segmenter', { value: original, configurable: true, writable: true });
      }
      expect(parseFeaturedTabEmoji('\u2728')).toBe('\u2728');
    });

    it.each([
      ['empty string', ''],
      ['whitespace', '  '],
      ['letters', 'ab'],
      ['two emoji', '\u2728\u2728'],
      ['emoji with text', '\u2728 hi'],
      ['a digit', '1'],
      ['markup', '<b>'],
      ['a bidi override before the emoji', '\u202E\u2728'],
      ['a zero-width joiner alone', '\u200D'],
      ['VS16 alone', '\uFE0F'],
      ['two skin-tone modifiers with no base', '\u{1F3FD}\u{1F3FD}'],
      ['a lone regional indicator', '\u{1F1FA}'],
      ['three regional indicators', '\u{1F1FA}\u{1F1F8}\u{1F1EC}'],
      ['tag characters with no black-flag base', '\u{E0067}\u{E007F}'],
      ['a zero-width space after an emoji', '\u2728\u200B'],
      ['a keycap', '1\uFE0F\u20E3'],
      // Extended_Pictographic includes these, but they read as text rather than
      // as a tab icon, and the Funnelcake validator rejects them on write.
      ['copyright', '\u00A9'],
      ['registered', '\u00AE'],
      ['trade mark', '\u2122'],
      ['trade mark with VS16', '\u2122\uFE0F'],
      ['information source', '\u2139'],
      ['circled M', '\u24C2'],
      ['a text symbol inside a ZWJ sequence', '\u{1F469}\u200D\u00A9'],
      ['null', null],
      ['undefined', undefined],
      ['a number', 42],
      ['an object', { emoji: '\u2728' }],
      ['more than 16 scalars', '\u{1F469}' + '\u200D\u{1F469}'.repeat(8)],
    ])('rejects %s', (_name, value) => {
      expect(parseFeaturedTabEmoji(value)).toBeNull();
    });
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
