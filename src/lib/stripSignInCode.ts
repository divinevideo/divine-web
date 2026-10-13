// ABOUTME: Removes a one-time sign-in code from the address on /app/callback
// ABOUTME: before anything else on the page runs. Has no imports on purpose.

const CODE_NAME = 'oauth_confirm';
const CALLBACK_PATH = '/app/callback';

/**
 * Removes `oauth_confirm` from the address's query and fragment on
 * /app/callback, and notes that it did. Loaded as the first module in
 * index.html, so error reporting, analytics and the router never see it.
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
  return true;
}

stripSignInCode();
