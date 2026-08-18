// ABOUTME: User-agent predicate for "is this browser running on a phone or tablet"
// ABOUTME: Deliberately about the device, not the viewport — see useIsMobile for width

// Kept in one place so the featured tab glyph and the app install prompt can
// never disagree about what counts as a mobile browser.
const MOBILE_USER_AGENT = /iphone|ipad|ipod|android|mobile/;

/**
 * Whether a user-agent string belongs to a mobile browser.
 *
 * Tolerates a missing agent rather than throwing: prerender and test callers
 * have no navigator to read, and a render that only wanted to pick a glyph
 * should not be the thing that takes the page down.
 */
export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return MOBILE_USER_AGENT.test(userAgent.toLowerCase());
}
