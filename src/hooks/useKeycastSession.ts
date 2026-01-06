// ABOUTME: Manages Keycast JWT session storage and expiration handling
// ABOUTME: Handles "remember me" functionality with 1-week session persistence

import { useCallback, useEffect, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { getJWTExpiration } from '@/lib/jwtDecode';

const TOKEN_KEY = 'keycast_jwt_token';
const EXPIRATION_KEY = 'keycast_jwt_expiration';
const SESSION_START_KEY = 'keycast_session_start';
const REMEMBER_ME_KEY = 'keycast_remember_me';
const EMAIL_KEY = 'keycast_email';
const PUBKEY_KEY = 'keycast_pubkey';
const AUTH_HANDLE_KEY = 'keycast_auth_handle';
const REFRESH_TOKEN_KEY = 'keycast_refresh_token';

const JWT_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours
const REMEMBER_ME_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const EXPIRATION_WARNING_MS = 60 * 60 * 1000; // 1 hour before expiration

export interface KeycastSession {
  token: string;
  email: string;
  pubkey: string;
  expiresAt: number;
  sessionStart: number;
  rememberMe: boolean;
}

export interface KeycastSessionState {
  session: KeycastSession | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  needsReauth: boolean;
}

export function useKeycastSession() {
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
  const [pubkey, setPubkey] = useLocalStorage<string | null>(PUBKEY_KEY, null);
  const [authHandle, setAuthHandle] = useLocalStorage<string | null>(AUTH_HANDLE_KEY, null);
  const [refreshTokenStored, setRefreshTokenStored] = useLocalStorage<string | null>(REFRESH_TOKEN_KEY, null);

  const [state, setState] = useState<KeycastSessionState>({
    session: null,
    isExpired: false,
    isExpiringSoon: false,
    needsReauth: false,
  });

  // Update state when storage values change
  useEffect(() => {
    if (!token || !expiration || !sessionStart || !email || !pubkey) {
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
        email,
        pubkey,
        expiresAt: expiration,
        sessionStart,
        rememberMe,
      },
      isExpired,
      isExpiringSoon,
      needsReauth: needsReauth || needsReauthDueToAge,
    });
  }, [token, expiration, sessionStart, rememberMe, email, pubkey]);

  /**
   * Save a new session after login or registration
   */
  const saveSession = useCallback(
    (
      newToken: string,
      userEmail: string,
      userPubkey: string,
      shouldRememberMe: boolean = false,
      refreshToken?: string,
      authorizationHandle?: string
    ) => {
      const now = Date.now();

      // Try to get the real expiration from the JWT token
      let expiresAt = getJWTExpiration(newToken);

      // Fallback to 24 hours if JWT doesn't have exp claim
      if (!expiresAt) {
        console.warn('[useKeycastSession] JWT token missing exp claim, using 24h default');
        expiresAt = now + JWT_LIFETIME_MS;
      } else {
        console.log('[useKeycastSession] JWT expires at:', new Date(expiresAt).toISOString());
        console.log('[useKeycastSession] Time until expiration:', Math.round((expiresAt - now) / 1000 / 60), 'minutes');
      }

      setToken(newToken);
      setExpiration(expiresAt);
      setSessionStart(now);
      setEmail(userEmail);
      setPubkey(userPubkey);
      setRememberMe(shouldRememberMe);
      if (refreshToken) {
        setRefreshTokenStored(refreshToken);
        console.log('[useKeycastSession] Saved refresh token for silent background refresh');
      }
      if (authorizationHandle) {
        setAuthHandle(authorizationHandle);
        console.log('[useKeycastSession] Saved authorization handle for consent-skip re-auth');
      }
    },
    [setToken, setExpiration, setSessionStart, setEmail, setPubkey, setRememberMe, setRefreshTokenStored, setAuthHandle]
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
        console.warn('[useKeycastSession] JWT token missing exp claim, using 24h default');
        expiresAt = now + JWT_LIFETIME_MS;
      } else {
        console.log('[useKeycastSession] Refreshed JWT expires at:', new Date(expiresAt).toISOString());
      }

      setToken(newToken);
      setExpiration(expiresAt);
      // Keep original sessionStart to track 1-week limit
    },
    [setToken, setExpiration]
  );

  /**
   * Clear session (logout)
   */
  const clearSession = useCallback(() => {
    setToken(null);
    setExpiration(null);
    setSessionStart(null);
    setEmail(null);
    setPubkey(null);
    setRememberMe(false);
    setRefreshTokenStored(null);
    setAuthHandle(null);
  }, [setToken, setExpiration, setSessionStart, setEmail, setPubkey, setRememberMe, setRefreshTokenStored, setAuthHandle]);

  /**
   * Get saved pubkey
   */
  const getPubkey = useCallback((): string | null => {
    return pubkey;
  }, [pubkey]);

  /**
   * Get authorization handle for consent-skip re-authentication
   */
  const getAuthHandle = useCallback((): string | null => {
    return authHandle;
  }, [authHandle]);

  /**
   * Get refresh token for silent background token refresh
   */
  const getRefreshToken = useCallback((): string | null => {
    return refreshTokenStored;
  }, [refreshTokenStored]);

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
    getPubkey,
    getAuthHandle,
    getRefreshToken,
  };
}
