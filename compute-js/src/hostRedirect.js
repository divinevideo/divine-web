// ABOUTME: Host redirect helpers for Fastly Compute request handling.
// ABOUTME: Prevents cached self-redirects when forwarded host metadata differs from the URL.

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
