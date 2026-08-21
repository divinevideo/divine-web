// ABOUTME: Mobile app store links, shared across the sidebar, install prompt and family pages
// ABOUTME: Static by design — a badge for a shipped app must not depend on a network call to render

export const DIVINE_IOS_APP_ID = '6747959501';

/**
 * Country-less on purpose. Apple 301-redirects this to the visitor's own
 * storefront, which is more accurate than anything we could derive client-side —
 * `navigator.languages` reports the browser's language, not the user's location.
 */
export const APP_STORE_URL = `https://apps.apple.com/app/id${DIVINE_IOS_APP_ID}`;

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=co.openvine.app&gl=us&hl=en';

export type MobilePlatform = 'ios' | 'android' | 'other';

export function detectMobilePlatform(userAgent: string): MobilePlatform {
  const normalizedUserAgent = userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(normalizedUserAgent)) {
    return 'ios';
  }

  if (/android/.test(normalizedUserAgent)) {
    return 'android';
  }

  return 'other';
}
