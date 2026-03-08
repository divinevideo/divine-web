/**
 * Cross-subdomain auth persistence via cookies.
 *
 * localStorage is per-origin, so divine.video and alice.divine.video
 * have separate login state. We mirror minimal login info to a cookie
 * with domain=.divine.video (or .dvines.org for staging) so any
 * subdomain can hydrate its localStorage.
 */

const COOKIE_NAME = 'nostr_login';

interface LoginCookieData {
  type: 'extension' | 'bunker' | 'nsec';
  pubkey: string;
  bunkerUri?: string; // only for bunker logins
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

  try {
    const value = btoa(JSON.stringify(loginData));
    const parts = [
      `${COOKIE_NAME}=${value}`,
      `domain=${domain}`,
      `path=/`,
      `max-age=${60 * 60 * 24 * 365}`, // 1 year
      `SameSite=Lax`,
      `Secure`,
    ];
    document.cookie = parts.join('; ');
  } catch {
    // silently fail - cookie is best-effort
  }
}

export function clearLoginCookie(): void {
  const domain = getCookieDomain();
  if (!domain) return;

  // Clear with domain
  document.cookie = `${COOKIE_NAME}=; domain=${domain}; path=/; max-age=0; Secure`;
  // Also clear without domain (in case one was set without it)
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; Secure`;
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

/**
 * Called on app startup (before React renders).
 * If localStorage has no login state but a cross-subdomain cookie exists,
 * hydrate localStorage so NostrLoginProvider picks it up.
 */
export function hydrateLoginFromCookie(): void {
  const STORAGE_KEY = 'nostr:login';

  // Already logged in on this origin - sync cookie FROM localStorage instead
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const logins = JSON.parse(stored);
      if (Array.isArray(logins) && logins.length > 0) {
        const first = logins[0];
        // Keep cookie in sync with current login
        setLoginCookie({
          type: first.type,
          pubkey: first.pubkey,
          ...(first.type === 'bunker' && first.data ? { bunkerUri: first.data } : {}),
        });
        return;
      }
    } catch {
      // corrupted localStorage, continue to cookie check
    }
  }

  const cookie = getLoginCookie();
  if (!cookie) return;

  // For extension logins, we can fully restore - the extension (window.nostr)
  // is available on all origins
  if (cookie.type === 'extension') {
    const loginState = [{
      id: crypto.randomUUID(),
      type: 'extension' as const,
      pubkey: cookie.pubkey,
    }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loginState));
    return;
  }

  // For bunker logins, restore with the bunker URI so it can reconnect
  if (cookie.type === 'bunker' && cookie.bunkerUri) {
    const loginState = [{
      id: crypto.randomUUID(),
      type: 'bunker' as const,
      pubkey: cookie.pubkey,
      data: cookie.bunkerUri,
    }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loginState));
    return;
  }

  // For nsec logins, we can't restore the private key from the cookie
  // (intentionally not stored for security). User will need to re-login
  // on this subdomain. We don't clear the cookie though, so other
  // subdomains where they're already logged in still work.
}
