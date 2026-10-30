// ABOUTME: Shared search query utilities
// ABOUTME: Guards and sanitizers reused across search hooks

/**
 * Detect URL-like input that causes Funnelcake 500 errors.
 * Catches both explicit URLs (https://vine.co/v/abc) and bare hostnames
 * with paths (vine.co/v/abc), aligned with parseHttpUrl() in directSearch.
 * See: https://github.com/divinevideo/divine-web/issues/166
 */
export function isUrlLikeQuery(query: string): boolean {
  const trimmed = query.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;

  // Bare hostname with path (e.g. vine.co/v/abc):
  // prepend https:// and try to parse — same approach as parseHttpUrl().
  // Require pathname beyond "/" to avoid false positives on "funny.cats".
  try {
    const url = new URL(`https://${trimmed}`);
    if (url.hostname.includes('.') && url.pathname.length > 1) return true;
  } catch {
    // not parseable — not a URL
  }

  return false;
}

/**
 * Detect input that contains a Nostr secret key (nsec), anywhere in the text
 * and in any case. Search skips such input and shows a warning instead.
 * Matches from the "nsec1" prefix on, so part of a key is handled the same
 * as a whole one. Bech32 data never contains "1", so npub, note, nevent and
 * naddr strings cannot match.
 */
export function looksLikeSecretKey(text: string): boolean {
  return /nsec1/i.test(text);
}
