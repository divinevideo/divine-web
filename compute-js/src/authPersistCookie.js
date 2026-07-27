// ABOUTME: Edge handler that emits Set-Cookie with Domain=.divine.video for the SPA.
// ABOUTME: Server-set fallback for cross-subdomain auth cookies (document.cookie can fail silently).

// Cookies the SPA is allowed to ask the edge to set/clear on its behalf.
// Anything outside this list is rejected — keeps this endpoint from being
// abused as a generic cookie-jar for the apex domain.
const PERSIST_COOKIE_ALLOWED = new Set(['nostr_login', 'divine_jwt']);
const PERSIST_COOKIE_MAX_VALUE = 3500;
const PERSIST_COOKIE_MAX_AGE_SECS = 60 * 60 * 24 * 365;
const JWT_DEFAULT_MAX_AGE_SECS = 60 * 60 * 24 * 7;

export function cookieDomainFor(hostname) {
  if (!hostname) return null;
  const host = hostname.split(':')[0].toLowerCase();
  if (host === 'divine.video' || host.endsWith('.divine.video')) return '.divine.video';
  if (host === 'dvines.org' || host.endsWith('.dvines.org')) return '.dvines.org';
  return null;
}

export async function handleAuthPersistCookie(request, hostname) {
  const isPost = request.method === 'POST';
  const isDelete = request.method === 'DELETE';
  if (!isPost && !isDelete) {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST, DELETE' } });
  }

  const domain = cookieDomainFor(hostname);
  if (!domain) {
    return new Response('No cross-subdomain domain for this host', { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const name = typeof body?.name === 'string' ? body.name : '';
  if (!PERSIST_COOKIE_ALLOWED.has(name)) {
    return new Response('Cookie name not allowed', { status: 403 });
  }

  let setCookie;
  if (isDelete) {
    // Mirror the two-write clear in crossSubdomainAuth.ts so we wipe both the
    // domain-scoped cookie and any host-only sibling that may have stuck around.
    setCookie = `${name}=; Domain=${domain}; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  } else {
    const value = typeof body?.value === 'string' ? body.value : '';
    // base64-only — values come from btoa(JSON.stringify(...)) on the SPA side.
    if (!/^[A-Za-z0-9+/=]{1,}$/.test(value) || value.length > PERSIST_COOKIE_MAX_VALUE) {
      return new Response('Invalid cookie value', { status: 400 });
    }
    let maxAge = Number.isFinite(body?.maxAge) ? Math.floor(body.maxAge) : 0;
    if (maxAge <= 0 || maxAge > PERSIST_COOKIE_MAX_AGE_SECS) {
      maxAge = name === 'divine_jwt' ? JWT_DEFAULT_MAX_AGE_SECS : PERSIST_COOKIE_MAX_AGE_SECS;
    }
    setCookie = `${name}=${value}; Domain=${domain}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
  }

  return new Response(null, {
    status: 204,
    headers: {
      'Set-Cookie': setCookie,
      'Cache-Control': 'no-store',
    },
  });
}
