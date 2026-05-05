// ABOUTME: Manages the hosted Divine JWT session storage and expiration handling
// ABOUTME: Preserves legacy storage keys so existing sessions survive the rename

import { useCallback, useEffect, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { getJWTExpiration } from '@/lib/jwtDecode';
import { setJwtCookie } from '@/lib/crossSubdomainAuth';

// Legacy key names stay in place so existing hosted-login sessions survive this rename.
const TOKEN_KEY = 'keycast_jwt_token';
const EXPIRATION_KEY = 'keycast_jwt_expiration';
const SESSION_START_KEY = 'keycast_session_start';
const REMEMBER_ME_KEY = 'keycast_remember_me';
const EMAIL_KEY = 'keycast_email';
const BUNKER_URL_KEY = 'keycast_bunker_url';

const JWT_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours
const REMEMBER_ME_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const EXPIRATION_WARNING_MS = 60 * 60 * 1000; // 1 hour before expiration

export interface DivineSession {
  token: string;
  email?: string;
  expiresAt: number;
  sessionStart: number;
  rememberMe: boolean;
  bunkerUrl?: string;
}

export interface DivineSessionState {
  session: DivineSession | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  needsReauth: boolean;
}

export function useDivineSession() {
  const [token, setToken] = useLocalStorage<string | null>(TOKEN_KEY, null);
  const [expiration, setExpiration] = useLocalStorage<number | null>(
    EXPIRATION_KEY,
    null
  );
  const [sessionStart, setSessionStart] = useLocalStorage<number | null>(
    SESSION_START_KEY,
    null
  );
  const [rememberMe, setRememberMe] = useLocalStorage<boolean>(
    REMEMBER_ME_KEY,
    false
  );
  const [email, setEmail] = useLocalStorage<string | null>(EMAIL_KEY, null);
  const [bunkerUrl, setBunkerUrl] = useLocalStorage<string | null>(BUNKER_URL_KEY, null);

  const [state, setState] = useState<DivineSessionState>({
    session: null,
    isExpired: false,
    isExpiringSoon: false,
    needsReauth: false,
  });

  // Update state when storage values change
  useEffect(() => {
    if (!token || !expiration || !sessionStart) {
      setState({
        session: null,
        isExpired: false,
        isExpiringSoon: false,
        needsReauth: false,
      });
      return;
    }

    const now = Date.now();
    const isExpired = now > expiration;
    const isExpiringSoon = now > expiration - EXPIRATION_WARNING_MS;
    const sessionAge = now - sessionStart;
    const sessionExpired = sessionAge > REMEMBER_ME_DURATION_MS;

    // If remember me is disabled and token expired, need reauth
    const needsReauth = !rememberMe && isExpired;

    // If session is older than 1 week (even with remember me), need reauth
    const needsReauthDueToAge = sessionExpired;

    setState({
      session: {
        token,
        email: email || undefined,
        expiresAt: expiration,
        sessionStart,
        rememberMe,
        bunkerUrl: bunkerUrl || undefined,
      },
      isExpired,
      isExpiringSoon,
      needsReauth: needsReauth || needsReauthDueToAge,
    });
  }, [token, expiration, sessionStart, rememberMe, email, bunkerUrl]);

  /**
   * Save a new session after login or registration
   */
  const saveSession = useCallback(
      (
        newToken: string,
        userEmail: string | null = null,
        shouldRememberMe: boolean = false
      ) => {
      const now = Date.now();

      // Try to get the real expiration from the JWT token
      let expiresAt = getJWTExpiration(newToken);

      // Fallback to 24 hours if JWT doesn't have exp claim
      if (!expiresAt) {
        console.warn('[useDivineSession] JWT token missing exp claim, using 24h default');
        expiresAt = now + JWT_LIFETIME_MS;
      } else {
        console.log('[useDivineSession] JWT expires at:', new Date(expiresAt).toISOString());
        console.log('[useDivineSession] Time until expiration:', Math.round((expiresAt - now) / 1000 / 60), 'minutes');
      }

      setToken(newToken);
      setExpiration(expiresAt);
      setSessionStart(now);
      setEmail(userEmail);
      setRememberMe(shouldRememberMe);

      // Share JWT session across subdomains via cookie
      setJwtCookie({
        token: newToken,
        expiration: expiresAt,
        sessionStart: now,
        rememberMe: shouldRememberMe,
        email: userEmail || undefined,
      });
    },
    [setToken, setExpiration, setSessionStart, setEmail, setRememberMe]
  );

  /**
   * Update session with a new token (after re-authentication)
   * Preserves the original session start time
   */
  const refreshSession = useCallback(
    (newToken: string) => {
      const now = Date.now();

      // Try to get the real expiration from the JWT token
      let expiresAt = getJWTExpiration(newToken);

      // Fallback to 24 hours if JWT doesn't have exp claim
      if (!expiresAt) {
        console.warn('[useDivineSession] JWT token missing exp claim, using 24h default');
        expiresAt = now + JWT_LIFETIME_MS;
      } else {
        console.log('[useDivineSession] Refreshed JWT expires at:', new Date(expiresAt).toISOString());
      }

      setToken(newToken);
      setExpiration(expiresAt);
      // Keep original sessionStart to track 1-week limit

      // Update JWT cookie with refreshed token
      if (sessionStart) {
        setJwtCookie({
          token: newToken,
          expiration: expiresAt,
          sessionStart,
          rememberMe,
          email: email || undefined,
          bunkerUrl: bunkerUrl || undefined,
        });
      }
    },
    [setToken, setExpiration, sessionStart, rememberMe, email, bunkerUrl]
  );

  /**
   * Save bunker URL (called after successful bunker connection)
   */
  const saveBunkerUrl = useCallback(
    (url: string) => {
      console.log('[useDivineSession] Saving bunker URL for persistent reconnection');
      setBunkerUrl(url);

      // Update JWT cookie with bunker URL
      if (token && expiration && sessionStart) {
        setJwtCookie({
          token,
          expiration,
          sessionStart,
          rememberMe,
          email: email || undefined,
          bunkerUrl: url,
        });
      }
    },
    [setBunkerUrl, token, expiration, sessionStart, rememberMe, email]
  );

  /**
   * Get saved bunker URL
   */
  const getSavedBunkerUrl = useCallback((): string | null => {
    return bunkerUrl;
  }, [bunkerUrl]);

  /**
   * Clear *this origin's* session keys.
   *
   * Intentionally does NOT clear the cross-subdomain `divine_jwt` cookie:
   * automatic expiry on one subdomain shouldn't log the user out everywhere.
   * `hydrateLoginFromCookie` already refuses to hydrate from an expired
   * cookie payload, so leaving the cookie behind is safe.
   *
   * Explicit logout (AccountSwitcher) calls `clearJwtCookie()` directly.
   */
  const clearSession = useCallback(() => {
    setToken(null);
    setExpiration(null);
    setSessionStart(null);
    setEmail(null);
    setRememberMe(false);
    setBunkerUrl(null);
  }, [setToken, setExpiration, setSessionStart, setEmail, setRememberMe, setBunkerUrl]);

  /**
   * Get valid token, or null if expired/missing
   */
  const getValidToken = useCallback((): string | null => {
    if (!token || !expiration) return null;

    const now = Date.now();
    if (now > expiration) {
      // Token is expired
      // If remember me is enabled, return token anyway (UI will prompt for refresh)
      // If remember me is disabled, clear session
      if (!rememberMe) {
        clearSession();
        return null;
      }
      // Still return token for remember me case, but caller should check needsReauth
      return token;
    }

    return token;
  }, [token, expiration, rememberMe, clearSession]);

  return {
    ...state,
    saveSession,
    refreshSession,
    clearSession,
    getValidToken,
    saveBunkerUrl,
    getSavedBunkerUrl,
  };
}
