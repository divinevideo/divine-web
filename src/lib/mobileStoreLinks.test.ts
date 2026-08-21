import { describe, expect, it } from 'vitest';
import {
  APP_STORE_URL,
  detectMobilePlatform,
  DIVINE_IOS_APP_ID,
  PLAY_STORE_URL,
} from './mobileStoreLinks';

describe('mobileStoreLinks', () => {
  it('points at the Divine App Store listing', () => {
    expect(APP_STORE_URL).toBe(`https://apps.apple.com/app/id${DIVINE_IOS_APP_ID}`);
  });

  it('omits the storefront country so Apple redirects to the visitor’s own', () => {
    // A hardcoded /us/ or /nz/ segment would send everyone to one storefront.
    // Apple 301s the country-less form to the right one.
    expect(APP_STORE_URL).not.toMatch(/apps\.apple\.com\/[a-z]{2}\//);
  });

  it('resolves the store links without any network call', () => {
    // Regression guard: these were once resolved at render time via a JSONP
    // lookup that failed closed, hiding the App Store badge whenever it was
    // blocked by CSP, an ad blocker, or a slow connection.
    expect(APP_STORE_URL).toMatch(/^https:\/\/apps\.apple\.com\//);
    expect(PLAY_STORE_URL).toMatch(/^https:\/\/play\.google\.com\//);
  });

  it.each([
    ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'ios'],
    ['iPad', 'Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X)', 'ios'],
    ['Android', 'Mozilla/5.0 (Linux; Android 15; Pixel 9)', 'android'],
    ['desktop', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'other'],
    ['modern iPadOS fallback', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Mobile/15E148 Safari/604.1', 'other'],
  ])('detects %s visitors as %s', (_label, userAgent, expected) => {
    expect(detectMobilePlatform(userAgent)).toBe(expected);
  });
});
