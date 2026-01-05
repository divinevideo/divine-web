// ABOUTME: OAuth callback handler for Keycast authentication
// ABOUTME: Exchanges authorization code for JWT and logs user in

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getOAuthState, clearOAuthState } from '@/lib/oauthState';
import { exchangeCodeForToken } from '@/lib/keycast';
import { useKeycastSession } from '@/hooks/useKeycastSession';
import { decodeUcanEmail } from '@/lib/ucanDecode';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Module-level set to track codes that have been used (persists across StrictMode double-mount)
const usedCodes = new Set<string>();

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { saveSession, saveBunkerUrl } = useKeycastSession();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Prevent double execution from React StrictMode
    let cancelled = false;

    async function handleCallback() {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      console.log('[AuthCallback] Starting callback handler', { code: code?.substring(0, 8), state: state?.substring(0, 8) });

      // Handle OAuth error
      if (errorParam) {
        setError(searchParams.get('error_description') || 'Authentication failed');
        setStatus('error');
        return;
      }

      // Validate required params
      if (!code || !state) {
        setError('Missing authorization code or state');
        setStatus('error');
        return;
      }

      // Get stored state
      const storedState = getOAuthState();
      console.log('[AuthCallback] Retrieved stored state', {
        hasState: !!storedState,
        nonce: storedState?.nonce?.substring(0, 8),
        verifier: storedState?.codeVerifier?.substring(0, 8),
      });

      if (!storedState) {
        setError('Session expired. Please try logging in again.');
        setStatus('error');
        return;
      }

      // Validate state (CSRF protection)
      if (state !== storedState.nonce) {
        console.log('[AuthCallback] State mismatch!', { urlState: state, storedNonce: storedState.nonce });
        setError('Security validation failed. Please try again.');
        setStatus('error');
        return;
      }

      // Check if already cancelled (React strict mode double-mount)
      if (cancelled) {
        console.log('[AuthCallback] Cancelled, skipping token exchange');
        return;
      }

      // Prevent double execution - codes can only be used once
      if (usedCodes.has(code)) {
        console.log('[AuthCallback] Code already used, skipping duplicate request');
        return;
      }
      usedCodes.add(code);

      try {
        // Exchange code for token and bunker URL
        console.log('[AuthCallback] Exchanging code for token...');
        const { token, pubkey, bunkerUrl } = await exchangeCodeForToken(
          code,
          storedState.codeVerifier
        );
        console.log('[AuthCallback] Token exchange successful', { pubkey: pubkey.substring(0, 8), hasBunkerUrl: !!bunkerUrl });

        // Once we have the token, always save it - don't check cancelled flag here
        // The token exchange already completed successfully on the server

        // Try to extract email from UCAN token, fallback to pubkey identifier
        const email = decodeUcanEmail(token) || `nostr:${pubkey.substring(0, 8)}`;

        // Save session (remember for 1 week by default for OAuth)
        saveSession(token, email, true);

        // Save bunker URL for NIP-46 signing (if needed later)
        saveBunkerUrl(bunkerUrl);

        // Clear OAuth state
        clearOAuthState();

        setStatus('success');

        // Redirect to original location
        setTimeout(() => {
          navigate(storedState.returnTo || '/', { replace: true });
        }, 1000);
      } catch (err) {
        // Always show errors - the code was already consumed so user needs to know what happened
        console.error('[AuthCallback] Token exchange failed:', err);
        setError(err instanceof Error ? err.message : 'Login failed');
        setStatus('error');
      }
    }

    handleCallback();

    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate, saveSession, saveBunkerUrl]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
            <h1 className="text-xl font-semibold">Completing login...</h1>
            <p className="text-muted-foreground">Please wait while we verify your credentials.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
            <h1 className="text-xl font-semibold">Login successful!</h1>
            <p className="text-muted-foreground">Redirecting you now...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold">Login failed</h1>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => navigate('/')} className="mt-4">
              Return to Home
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default AuthCallbackPage;
