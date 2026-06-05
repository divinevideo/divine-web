/**
 * Cross-subdomain auth persistence via cookies.
 *
 * localStorage is per-origin, so divine.video and alice.divine.video
 * have separate login state. We mirror minimal login info to a cookie
 * with domain=.divine.video (or .dvines.org for staging) so any
 * subdomain can hydrate its localStorage.
 *
 * Cookies are written two ways:
 *   1. Synchronously via document.cookie — works in most browsers/contexts.
 *   2. Asynchronously via POST /api/auth/persist-cookie — server emits
 *      Set-Cookie. This is the reliable path: some browsers (Brave, Firefox
 *      ETP-Strict, Safari ITP edge cases) silently drop document.cookie
 *      writes that would otherwise look fine.
 */

const COOKIE_NAME = 'nostr_login';
const JWT_COOKIE_NAME = 'divine_jwt';
const PERSIST_ENDPOINT = '/api/auth/persist-cookie';
const NOSTR_LOGIN_MAX_AGE_SECS = 60 * 60 * 24 * 365; // 1 year
const JWT_MAX_AGE_SECS = 60 * 60 * 24 * 7; // 1 week (matches session max)

function persistCookieOnServer(name: string, value: string, maxAge: number): void {
  if (typeof fetch !== 'function') return;
  // Fire-and-forget. Errors (offline, edge worker hiccup) are non-fatal —
  // document.cookie above is the primary path, this is the reliable backup.
  void fetch(PERSIST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, value, maxAge }),
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => undefined);
}

function clearCookieOnServer(name: string): void {
  if (typeof fetch !== 'function') return;
  void fetch(PERSIST_ENDPOINT, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => undefined);
}

// NOTE: `clientNsec` is an ephemeral, per-login client key (generated fresh by
// NLogin.fromBunker), NOT the user's identity key — the remote bunker holds the
// identity key. Persisting this object in the cross-subdomain cookie is required
// so subdomains can rebuild the NIP-46 signer; it predates this change (the
// localStorage-sync path already wrote it) and the cookie is Secure + SameSite=Lax.
export interface BunkerLoginData {
  bunkerPubkey: string;
  clientNsec: string;
  relays: string[];
}

interface LoginCookieData {
  type: 'extension' | 'bunker' | 'nsec';
  pubkey: string;
  bunkerData?: BunkerLoginData; // only for bunker logins; the exact shape NUser.fromBunkerLogin consumes
}

/**
 * Structural guard for a bunker login `data` payload. A raw `bunker://` URI
 * string (the legacy/poisoned shape) and any partial object fail this, so they
 * are never persisted into localStorage where NUser.fromBunkerLogin would throw.
 */
export function isValidBunkerData(data: unknown): data is BunkerLoginData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.bunkerPubkey === 'string' &&
    typeof d.clientNsec === 'string' &&
    d.clientNsec.startsWith('nsec1') &&
    Array.isArray(d.relays) &&
    d.relays.length > 0 &&
    d.relays.every((relay) => typeof relay === 'string')
  );
}

interface JwtCookieData {
  token: string;
  expiration: number;
  sessionStart: number;
  rememberMe: boolean;
  email?: string;
  bunkerUrl?: string;
}

export function getCookieDomain(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname;
  if (hostname.endsWith('.divine.video') || hostname === 'divine.video') return '.divine.video';
  if (hostname.endsWith('.dvines.org') || hostname === 'dvines.org') return '.dvines.org';
  return null; // localhost or unknown — don't set cross-subdomain cookies
}

export function setLoginCookie(loginData: LoginCookieData): void {
  const domain = getCookieDomain();
  if (!domain) return; // cookies with domain= don't work on localhost

  let value: string;
  try {
    value = btoa(JSON.stringify(loginData));
  } catch {
    return;
  }

  try {
    const parts = [
      `${COOKIE_NAME}=${value}`,
      `domain=${domain}`,
      `path=/`,
      `max-age=${NOSTR_LOGIN_MAX_AGE_SECS}`,
      `SameSite=Lax`,
      `Secure`,
    ];
    document.cookie = parts.join('; ');
  } catch {
    // silently fail - cookie is best-effort
  }

  persistCookieOnServer(COOKIE_NAME, value, NOSTR_LOGIN_MAX_AGE_SECS);
}

export function clearLoginCookie(): void {
  const domain = getCookieDomain();
  if (!domain) return;

  // Clear with domain
  document.cookie = `${COOKIE_NAME}=; domain=${domain}; path=/; max-age=0; Secure`;
  // Also clear without domain (in case one was set without it)
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; Secure`;

  clearCookieOnServer(COOKIE_NAME);
}

export function getLoginCookie(): LoginCookieData | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
    if (!match) return null;
    return JSON.parse(atob(match[1]));
  } catch {
    return null;
  }
}

// --- JWT cross-subdomain cookie (for hosted Divine login sessions) ---

export function setJwtCookie(data: JwtCookieData): void {
  const domain = getCookieDomain();
  if (!domain) return;

  let value: string;
  try {
    value = btoa(JSON.stringify(data));
  } catch {
    return;
  }

  try {
    const parts = [
      `${JWT_COOKIE_NAME}=${value}`,
      `domain=${domain}`,
      `path=/`,
      `max-age=${JWT_MAX_AGE_SECS}`,
      `SameSite=Lax`,
      `Secure`,
    ];
    document.cookie = parts.join('; ');
  } catch {
    // silently fail - cookie is best-effort
  }

  persistCookieOnServer(JWT_COOKIE_NAME, value, JWT_MAX_AGE_SECS);
}

export function getJwtCookie(): JwtCookieData | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${JWT_COOKIE_NAME}=([^;]+)`));
    if (!match) return null;
    return JSON.parse(atob(match[1]));
  } catch {
    return null;
  }
}

export function clearJwtCookie(): void {
  const domain = getCookieDomain();
  if (!domain) return;

  document.cookie = `${JWT_COOKIE_NAME}=; domain=${domain}; path=/; max-age=0; Secure`;
  document.cookie = `${JWT_COOKIE_NAME}=; path=/; max-age=0; Secure`;

  clearCookieOnServer(JWT_COOKIE_NAME);
}

/**
 * Called on app startup (before React renders).
 * If localStorage has no login state but a cross-subdomain cookie exists,
 * hydrate localStorage so NostrLoginProvider picks it up.
 */
export function hydrateLoginFromCookie(): void {
  const STORAGE_KEY = 'nostr:login';
  // hydrateLoginFromCookie runs once per page load, so this is low-volume
  // (a handful of info lines per load, not per render). It stays on in
  // production deliberately: the failure modes it diagnoses (Brave, Firefox
  // ETP-Strict, Safari ITP dropping cross-subdomain cookies) only reproduce in
  // real browsers, so prod is exactly where the diagnostics need to be visible.
  const log = (...args: unknown[]) => console.info('[crossSubdomainAuth]', ...args);

  // --- JWT session hydration ---
  // JWT keys used by useDivineSession (must match those constants)
  const JWT_TOKEN_KEY = 'keycast_jwt_token';
  const JWT_EXPIRATION_KEY = 'keycast_jwt_expiration';
  const JWT_SESSION_START_KEY = 'keycast_session_start';
  const JWT_REMEMBER_ME_KEY = 'keycast_remember_me';
  const JWT_EMAIL_KEY = 'keycast_email';
  const JWT_BUNKER_URL_KEY = 'keycast_bunker_url';

  // useLocalStorage wraps values with JSON.stringify, so we parse them back
  const rawJwt = localStorage.getItem(JWT_TOKEN_KEY);
  const existingJwt = rawJwt ? JSON.parse(rawJwt) : null;
  if (existingJwt) {
    // Already have JWT on this origin — keep cookie in sync
    const expiration = localStorage.getItem(JWT_EXPIRATION_KEY);
    const sessionStart = localStorage.getItem(JWT_SESSION_START_KEY);
    if (expiration && sessionStart) {
      log('JWT: localStorage present, syncing cookie');
      setJwtCookie({
        token: existingJwt,
        expiration: JSON.parse(expiration),
        sessionStart: JSON.parse(sessionStart),
        rememberMe: JSON.parse(localStorage.getItem(JWT_REMEMBER_ME_KEY) || 'false'),
        email: JSON.parse(localStorage.getItem(JWT_EMAIL_KEY) || 'null') || undefined,
        bunkerUrl: JSON.parse(localStorage.getItem(JWT_BUNKER_URL_KEY) || 'null') || undefined,
      });
    }
  } else {
    // No JWT on this origin — check cookie
    const jwtCookie = getJwtCookie();
    if (!jwtCookie) {
      log('JWT: no localStorage, no cookie');
    } else if (!jwtCookie.token) {
      log('JWT: cookie present but missing token field');
    } else if (jwtCookie.expiration <= Date.now()) {
      log('JWT: cookie present but expired', {
        expiredSecAgo: Math.round((Date.now() - jwtCookie.expiration) / 1000),
      });
    } else {
      log('JWT: hydrating localStorage from cookie', {
        expiresInSec: Math.round((jwtCookie.expiration - Date.now()) / 1000),
      });
      localStorage.setItem(JWT_TOKEN_KEY, JSON.stringify(jwtCookie.token));
      localStorage.setItem(JWT_EXPIRATION_KEY, JSON.stringify(jwtCookie.expiration));
      localStorage.setItem(JWT_SESSION_START_KEY, JSON.stringify(jwtCookie.sessionStart));
      localStorage.setItem(JWT_REMEMBER_ME_KEY, JSON.stringify(jwtCookie.rememberMe));
      if (jwtCookie.email) {
        localStorage.setItem(JWT_EMAIL_KEY, JSON.stringify(jwtCookie.email));
      }
      if (jwtCookie.bunkerUrl) {
        localStorage.setItem(JWT_BUNKER_URL_KEY, JSON.stringify(jwtCookie.bunkerUrl));
      }
    }
  }

  // --- Nostr login hydration (extension/bunker/nsec) ---

  // Already logged in on this origin - sync cookie FROM localStorage instead
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const logins = JSON.parse(stored);
      if (Array.isArray(logins) && logins.length > 0) {
        // Self-heal: a bunker login whose `data` is not a valid object is the
        // legacy/poisoned shape. Persisting it would make NUser.fromBunkerLogin
        // throw (apparent logout) and re-syncing it would re-poison the shared
        // cookie. Drop those entries.
        //
        // Scope: only `bunker` data is validated here, because the cookie
        // data-shape ambiguity was bunker-specific. Malformed nsec/extension
        // logins (rare) are already handled gracefully downstream — the login
        // filters in useCurrentUser / useLoggedInAccounts swallow the throw — so
        // this self-heal stays bunker-scoped.
        const cleaned = logins.filter(
          (l: { type?: string; data?: unknown }) =>
            l.type !== 'bunker' || isValidBunkerData(l.data),
        );
        if (cleaned.length !== logins.length) {
          if (cleaned.length === 0) {
            // Everything was poisoned. Remove the bad local state but DON'T clear
            // the shared cookie or return — fall through to cookie hydration so a
            // healthy cookie (written by another origin) can recover the session.
            localStorage.removeItem(STORAGE_KEY);
          } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
          }
        }

        if (cleaned.length > 0) {
          // If the original first login was a dropped poison entry, the next
          // valid login becomes the cookie's advertised identity. That's
          // intended: the poisoned login was unusable, so promoting the next
          // working one is better than advertising a login that can't sign.
          const first = cleaned[0];
          log('nostr_login: localStorage present, syncing cookie', { type: first.type });
          // Keep cookie in sync with current login
          setLoginCookie({
            type: first.type,
            pubkey: first.pubkey,
            ...(first.type === 'bunker' && isValidBunkerData(first.data)
              ? { bunkerData: first.data }
              : {}),
          });
          return;
        }
        // cleaned.length === 0: fall through to cookie-based recovery below.
      }
    } catch {
      // corrupted localStorage, continue to cookie check
    }
  }

  const cookie = getLoginCookie();
  if (!cookie) {
    log('nostr_login: no localStorage, no cookie');
    return;
  }

  // For extension logins, we can fully restore - the extension (window.nostr)
  // is available on all origins
  if (cookie.type === 'extension') {
    log('nostr_login: hydrating extension login from cookie');
    const loginState = [{
      id: crypto.randomUUID(),
      type: 'extension' as const,
      pubkey: cookie.pubkey,
    }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loginState));
    return;
  }

  // For bunker logins, restore from the structured data object so the signer
  // can be rebuilt. A legacy/poisoned cookie (raw bunker:// string under the old
  // `bunkerUri` field, or any malformed payload) fails the guard and is ignored
  // rather than persisted — NUser.fromBunkerLogin would throw on a bad shape and
  // the user would appear logged out. They re-login instead.
  if (cookie.type === 'bunker') {
    if (isValidBunkerData(cookie.bunkerData)) {
      log('nostr_login: hydrating bunker login from cookie');
      const loginState = [{
        id: crypto.randomUUID(),
        type: 'bunker' as const,
        pubkey: cookie.pubkey,
        data: cookie.bunkerData,
      }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loginState));
    } else {
      log('nostr_login: bunker cookie present but data shape invalid — re-login required on this subdomain');
    }
    return;
  }

  if (cookie.type === 'nsec') {
    log('nostr_login: nsec cookie present but private key not in cookie — re-login required on this subdomain');
  }

  // For nsec logins, we can't restore the private key from the cookie
  // (intentionally not stored for security). User will need to re-login
  // on this subdomain. We don't clear the cookie though, so other
  // subdomains where they're already logged in still work.
}
