// ABOUTME: Host redirect helpers for Fastly Compute request handling.
// ABOUTME: Handles www removal and same-host path redirects. Prevents cached self-redirects when forwarded host metadata differs from the URL.

export function buildWwwRedirectResponse(url, hostnameToUse) {
  if (!hostnameToUse.startsWith('www.')) {
    return null;
  }

  const targetUrl = new URL(url);
  targetUrl.hostname = hostnameToUse.slice(4);

  if (targetUrl.toString() === url.toString()) {
    return null;
  }

  return redirectNoStore(targetUrl.toString(), 301);
}

const ACCOUNT_PORTABILITY_PATHS = new Set(['/account-portability', '/account-portability/']);

// /account-portability moved to /exit (#591). This is a same-host redirect, so
// it cannot use EXTERNAL_REDIRECTS, which maps exact paths to absolute
// cross-host URLs and drops the query string.
export function buildAccountPortabilityRedirectResponse(url, hostnameToUse) {
  if (!ACCOUNT_PORTABILITY_PATHS.has(url.pathname)) {
    return null;
  }

  const targetUrl = new URL(url);
  targetUrl.hostname = hostnameToUse;
  targetUrl.pathname = '/exit';

  return redirectNoStore(targetUrl.toString(), 301);
}

function redirectNoStore(location, status) {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
      Vary: 'X-Original-Host, X-Forwarded-Host',
    },
  });
}
