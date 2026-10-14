// ABOUTME: Removes a one-time sign-in code from the address on /app/callback
// ABOUTME: ahead of HubSpot and the app. Has no imports on purpose.

const CODE_NAME = 'oauth_confirm';
const CALLBACK_PATH = '/app/callback';

function removeCodePairs(raw: string): string {
  return raw.slice(1).split('&').filter((pair) => !new URLSearchParams(pair).has(CODE_NAME)).join('&');
}

// Decodes the path the way react-router does before it matches routes, so
// the strip runs on every path that renders the callback page: segment by
// segment, keeping an encoded `/` encoded, and falling back to the path as
// written when an escape is malformed.
function decodePath(pathname: string): string {
  try {
    return pathname.split('/').map((segment) => decodeURIComponent(segment).replace(/\//g, '%2F')).join('/');
  } catch {
    return pathname;
  }
}

/**
 * Removes `oauth_confirm` from the address's query and fragment on
 * /app/callback, notes that it did, and turns analytics off for the rest of
 * the document, until the page is reloaded or left. Loaded as the first
 * module in index.html, so later scripts read the address without it.
 * Analytics stays off because the browser still keeps the address the page
 * was opened with in its navigation timing entry, for as long as the
 * document lasts.
 *
 * The verifier sends the code after the `#` by default, and this fully
 * protects only that placement. Putting the code in the query is an
 * emergency fallback: there the code has already reached servers with the
 * page request before this runs. If query placement is ever turned on,
 * /app/callback would also need a no-referrer Referrer-Policy header.
 */
export function stripSignInCode(): boolean {
  if (typeof window === 'undefined') return false;
  const { pathname, search, hash } = window.location;
  if (decodePath(pathname).replace(/\/+$/, '').toLowerCase() !== CALLBACK_PATH) return false;
  const nextSearch = removeCodePairs(search);
  const nextHash = removeCodePairs(hash);
  if (nextSearch === search.slice(1) && nextHash === hash.slice(1)) return false;
  window.__DIVINE_SIGNIN_CODE_STRIPPED__ = true;
  window.__DIVINE_ANALYTICS_DISABLED__ = true;
  try {
    window.history.replaceState(
      window.history.state,
      '',
      pathname + (nextSearch ? `?${nextSearch}` : '') + (nextHash ? `#${nextHash}` : ''),
    );
  } catch {
    return true;
  }
  return true;
}

stripSignInCode();
