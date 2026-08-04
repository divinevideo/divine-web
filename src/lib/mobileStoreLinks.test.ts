import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_STORE_URL,
  DIVINE_IOS_APP_ID,
  getPreferredAppStoreCountry,
  lookupAppStoreUrl,
} from './mobileStoreLinks';

function resolveLatestLookup(result: unknown) {
  const script = document.head.querySelector<HTMLScriptElement>('script[src*="itunes.apple.com/lookup"]');
  expect(script).not.toBeNull();

  const callback = new URL(script!.src).searchParams.get('callback');
  expect(callback).toBeTruthy();

  (window as unknown as Record<string, (value: unknown) => void>)[callback!](result);
}

describe('mobileStoreLinks', () => {
  afterEach(() => {
    document.head.querySelectorAll('script[src*="itunes.apple.com/lookup"]').forEach((script) => script.remove());
    vi.restoreAllMocks();
  });

  it('points at the Divine App Store listing', () => {
    expect(APP_STORE_URL).toBe(`https://apps.apple.com/app/id${DIVINE_IOS_APP_ID}`);
  });

  it('omits the storefront country so Apple redirects to the visitor’s own', () => {
    // A hardcoded /us/ or /nz/ segment would send everyone to one storefront.
    // Apple 301s the country-less form to the right one.
    expect(APP_STORE_URL).not.toMatch(/apps\.apple\.com\/[a-z]{2}\//);
  });

  it('derives the App Store country from browser languages', () => {
    expect(getPreferredAppStoreCountry(['en-NZ', 'en-US'])).toBe('nz');
    expect(getPreferredAppStoreCountry(['en-US'])).toBe('us');
    expect(getPreferredAppStoreCountry(['en'])).toBeNull();
  });

  it('resolves a live App Store URL when Apple lookup finds the app', async () => {
    const promise = lookupAppStoreUrl('nz');

    resolveLatestLookup({
      resultCount: 1,
      results: [{ trackViewUrl: 'https://apps.apple.com/nz/app/divine-video/id6747959501?uo=4' }],
    });

    await expect(promise).resolves.toBe('https://apps.apple.com/nz/app/divine-video/id6747959501?uo=4');
  });

  it('resolves null when Apple lookup has no result for the storefront', async () => {
    const promise = lookupAppStoreUrl('us');

    resolveLatestLookup({
      resultCount: 0,
      results: [],
    });

    await expect(promise).resolves.toBeNull();
  });
});
