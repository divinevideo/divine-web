// ABOUTME: Monitors Keycast JWT session and handles automatic token refresh
// ABOUTME: Uses refresh_token for silent refresh, authorization_handle for consent-skip fallback

import { useEffect, useRef } from 'react';
import { useKeycastSession } from '@/hooks/useKeycastSession';
import { useNostrLogin } from '@nostrify/react/login';
import { toast } from '@/hooks/useToast';
import { refreshAccessToken, buildOAuthAuthorizeUrl } from '@/lib/keycast';
import { saveOAuthState } from '@/lib/oauthState';
import { generateCodeChallenge, generateCodeVerifier, generateNonce } from '@/lib/pkce';

export function KeycastSessionMonitor() {
  const { isExpired, isExpiringSoon, needsReauth, getAuthHandle, getRefreshToken, getPubkey, saveSession, session } = useKeycastSession();
  const { logins } = useNostrLogin();
  const hasAttemptedRefresh = useRef(false);
  const isRefreshing = useRef(false);

  // Check if user has a Keycast login
  const hasKeycastLogin = logins.some(
    (login) => login.type === ('x-keycast' as unknown)
  );

  useEffect(() => {
    // Only monitor if user has a Keycast login
    if (!hasKeycastLogin) {
      hasAttemptedRefresh.current = false;
      return;
    }

    const refreshToken = getRefreshToken();
    const authHandle = getAuthHandle();
    const pubkey = getPubkey();

    // No credentials available for refresh
    if (!pubkey) {
      return;
    }

    // Check if we need to refresh (expired or expiring soon)
    const shouldRefresh = (isExpired || isExpiringSoon || needsReauth) && !hasAttemptedRefresh.current;

    if (shouldRefresh) {
      hasAttemptedRefresh.current = true;
      attemptBackgroundRefresh(refreshToken, authHandle, pubkey);
    }
  }, [isExpired, isExpiringSoon, needsReauth, hasKeycastLogin, getAuthHandle, getRefreshToken, getPubkey, saveSession, session]);

  async function attemptBackgroundRefresh(refreshToken: string | null, authHandle: string | null, pubkey: string) {
    if (isRefreshing.current) return;
    isRefreshing.current = true;

    try {
      // Prefer refresh_token for truly silent refresh (no redirect)
      if (refreshToken) {
        console.log('[KeycastSessionMonitor] Attempting background token refresh with refresh_token...');
        const result = await refreshAccessToken(refreshToken);

        // Update session with new credentials (including rotated refresh token)
        const email = session?.email || `nostr:${pubkey.substring(0, 8)}`;
        saveSession(result.token, email, result.pubkey, true, result.refreshToken, result.authorizationHandle);

        console.log('[KeycastSessionMonitor] Token refreshed successfully');
        return;
      }

      // No refresh token available, fall back to OAuth redirect
      console.log('[KeycastSessionMonitor] No refresh_token available, falling back to OAuth re-auth');
      if (authHandle) {
        showReloginToast(authHandle);
      } else {
        // No credentials at all, user needs to log in again
        toast({
          title: 'Session Expired',
          description: 'Please log in again to continue.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.warn('[KeycastSessionMonitor] Background refresh failed:', error);
      // Refresh token invalid/expired, fall back to OAuth redirect with authorization_handle
      if (authHandle) {
        showReloginToast(authHandle);
      } else {
        toast({
          title: 'Session Expired',
          description: 'Please log in again to continue.',
          variant: 'destructive',
        });
      }
    } finally {
      isRefreshing.current = false;
    }
  }

  function showReloginToast(authHandle: string) {
    toast({
      title: 'Session Expired',
      description: 'Your session has expired. Reconnecting...',
    });
    // Auto-initiate re-auth with authorization handle (consent-skip)
    initiateOAuthReauth(authHandle);
  }

  return null;
}

async function initiateOAuthReauth(authHandle: string) {
  console.log('[KeycastSessionMonitor] Initiating OAuth re-auth with authorization handle (consent-skip)');

  try {
    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const nonce = generateNonce();

    // Save OAuth state for callback
    saveOAuthState({
      nonce,
      codeVerifier,
      returnTo: window.location.pathname + window.location.search + window.location.hash,
    });

    // Build authorize URL with authorization_handle for auto-approve (skip consent)
    const authorizeUrl = buildOAuthAuthorizeUrl({
      codeChallenge,
      state: nonce,
      authorizationHandle: authHandle,
    });

    // Redirect to Keycast (will auto-approve and redirect back quickly)
    window.location.href = authorizeUrl;
  } catch (error) {
    console.error('[KeycastSessionMonitor] Failed to initiate re-auth:', error);
    toast({
      title: 'Reconnection Failed',
      description: 'Please try logging in again.',
      variant: 'destructive',
    });
  }
}

export default KeycastSessionMonitor;
