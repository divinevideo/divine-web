// ABOUTME: Unit tests for publishVideoTag helpers
import { describe, it, expect, vi, afterEach } from 'vitest';

import { buildImetaTag, generateVineId } from './publishVideoTags';

describe('publishVideoTags', () => {
  describe('generateVineId', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns vine-{ms}-{alphanumeric} with fixed clock and random', () => {
      vi.spyOn(Date, 'now').mockReturnValue(17_000_000_000);
      vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

      expect(generateVineId()).toBe('vine-17000000000-4fzzzxj');
    });

    it('without mocks matches stable pattern', () => {
      expect(generateVineId()).toMatch(/^vine-\d+-[a-z0-9]+$/);
    });
  });

  describe('buildImetaTag', () => {
    it('includes url and mime when provided', () => {
      expect(
        buildImetaTag({
          url: 'https://example.com/v.mp4',
          mimeType: 'video/mp4',
        })
      ).toEqual(['imeta', 'url', 'https://example.com/v.mp4', 'm', 'video/mp4']);
    });

    it('uses gif mime when caller passes image/gif explicitly', () => {
      expect(
        buildImetaTag({
          url: 'https://x.gif',
          mimeType: 'image/gif',
        })
      ).toEqual(['imeta', 'url', 'https://x.gif', 'm', 'image/gif']);
    });

    it('includes dim, blurhash, image, duration, size, x when set', () => {
      expect(
        buildImetaTag({
          url: 'u',
          dimensions: '1080x1920',
          blurhash: 'LB',
          thumbnailUrl: 'thumb.jpg',
          duration: 6,
          size: 1024,
          hash: 'deadbeef',
        })
      ).toEqual([
        'imeta',
        'url',
        'u',
        'dim',
        '1080x1920',
        'blurhash',
        'LB',
        'image',
        'thumb.jpg',
        'duration',
        '6',
        'size',
        '1024',
        'x',
        'deadbeef',
      ]);
    });

    it('returns only imeta when metadata has no populated optional fields and no url', () => {
      expect(buildImetaTag({ url: '' })).toEqual(['imeta']);
    });
  });
});
