// ABOUTME: Removes a one-time sign-in code from the address on /app/callback
// ABOUTME: ahead of HubSpot and the app. Has no imports on purpose.

const CODE_NAME = 'oauth_confirm';
const CALLBACK_PATH = '/app/callback';

/**
 * Removes `oauth_confirm` from the address's query and fragment on
 * /app/callback, notes that it did, and turns analytics off for the page
 * view. Loaded as the first module in index.html, so later scripts read the
 * address without it. Analytics stays off because the browser still keeps
 * the address the page was opened with in its navigation timing entry.
 */
export function stripSignInCode(): boolean {
  if (typeof window === 'undefined') return false;
  const { pathname, search, hash } = window.location;
  if (pathname !== CALLBACK_PATH) return false;
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  if (!query.has(CODE_NAME) && !fragment.has(CODE_NAME)) return false;
  query.delete(CODE_NAME);
  fragment.delete(CODE_NAME);
  const nextSearch = query.toString();
  const nextHash = fragment.toString();
  window.history.replaceState(
    window.history.state,
    '',
    pathname + (nextSearch ? `?${nextSearch}` : '') + (nextHash ? `#${nextHash}` : ''),
  );
  window.__DIVINE_SIGNIN_CODE_STRIPPED__ = true;
  window.__DIVINE_ANALYTICS_DISABLED__ = true;
  return true;
}

stripSignInCode();
