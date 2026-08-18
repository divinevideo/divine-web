import { describe, expect, it } from 'vitest';
import { isMobileUserAgent } from './isMobileUserAgent';

describe('isMobileUserAgent', () => {
  it('matches phone and tablet browsers', () => {
    const agents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPod touch; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Android 13; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0',
    ];

    for (const agent of agents) {
      expect(isMobileUserAgent(agent), agent).toBe(true);
    }
  });

  it('does not match desktop browsers', () => {
    const agents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
    ];

    for (const agent of agents) {
      expect(isMobileUserAgent(agent), agent).toBe(false);
    }
  });

  it('is case insensitive', () => {
    expect(isMobileUserAgent('SOME-BROWSER/1.0 (IPHONE)')).toBe(true);
  });

  // Prerender and non-browser callers have no navigator to read, and a thrown
  // TypeError there would take down a render that only wanted to pick a glyph.
  it('treats a missing user agent as not mobile', () => {
    expect(isMobileUserAgent(undefined)).toBe(false);
    expect(isMobileUserAgent(null)).toBe(false);
    expect(isMobileUserAgent('')).toBe(false);
  });
});
