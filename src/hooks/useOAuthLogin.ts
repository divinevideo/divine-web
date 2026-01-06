// ABOUTME: Hook to initiate OAuth login flow with Keycast
// ABOUTME: Handles PKCE generation, state storage, and redirect

import { useState, useCallback } from 'react';
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/pkce';
import { saveOAuthState } from '@/lib/oauthState';
import { buildOAuthAuthorizeUrl } from '@/lib/keycast';

export function useOAuthLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startOAuthLogin = useCallback(async (options?: { returnTo?: string; signup?: boolean }) => {
    setIsLoading(true);
    setError(null);

    try {
      // Generate PKCE verifier and challenge
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Generate state nonce for CSRF protection
      const nonce = generateCodeVerifier().substring(0, 16);

      // Save state for callback
      saveOAuthState({
        codeVerifier,
        returnTo: options?.returnTo || window.location.pathname + window.location.search + window.location.hash,
        nonce,
      });

      // Build and redirect to authorization URL
      const authUrl = buildOAuthAuthorizeUrl({
        codeChallenge,
        state: nonce,
        signup: options?.signup,
      });

      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start login');
      setIsLoading(false);
    }
  }, []);

  return {
    startOAuthLogin,
    isLoading,
    error,
  };
}
