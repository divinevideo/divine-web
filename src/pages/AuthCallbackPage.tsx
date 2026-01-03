// ABOUTME: OAuth callback handler for Keycast authentication
// ABOUTME: Exchanges authorization code for JWT and logs user in

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getOAuthState, clearOAuthState } from '@/lib/oauthState';
import { exchangeCodeForToken } from '@/lib/keycast';
import { useKeycastSession } from '@/hooks/useKeycastSession';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { saveSession } = useKeycastSession();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

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
      if (!storedState) {
        setError('Session expired. Please try logging in again.');
        setStatus('error');
        return;
      }

      // Validate state (CSRF protection)
      if (state !== storedState.nonce) {
        setError('Security validation failed. Please try again.');
        setStatus('error');
        return;
      }

      try {
        // Exchange code for token
        const { token, pubkey } = await exchangeCodeForToken(
          code,
          storedState.codeVerifier
        );

        // Save session (remember for 1 week by default for OAuth)
        saveSession(token, `oauth:${pubkey.substring(0, 8)}`, true);

        // Clear OAuth state
        clearOAuthState();

        setStatus('success');

        // Redirect to original location
        setTimeout(() => {
          navigate(storedState.returnTo || '/', { replace: true });
        }, 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed');
        setStatus('error');
      }
    }

    handleCallback();
  }, [searchParams, navigate, saveSession]);

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
