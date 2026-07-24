// ABOUTME: Coarse platform detection for choosing app-store destinations
// ABOUTME: iOS vs Android vs desktop, from the user agent; defaults to desktop

export type Platform = 'ios' | 'android' | 'desktop';

/**
 * Detect the visitor's platform for the purpose of picking a download target.
 *
 * Deliberately coarse — we only need to decide which app stores to offer:
 * - `ios`: iPhone/iPad/iPod (App Store only).
 * - `android`: Android (Google Play + Zapstore).
 * - `desktop`: everything else, including when there is no navigator, e.g. the
 *   prerender pass (offer all three).
 *
 * `userAgent` is injectable for testing. Modern iPadOS reports a Mac-like UA, so
 * an iPad-in-desktop-mode falls through to `desktop` (all three, incl. App
 * Store) — an acceptable outcome for a store picker.
 */
export function detectPlatform(
  userAgent: string | undefined =
    typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
): Platform {
  if (!userAgent) return 'desktop';
  const ua = userAgent.toLowerCase();

  // Android UAs also contain "mobile"/"linux"; check Android before iOS just in
  // case, though the token sets don't overlap.
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  return 'desktop';
}
