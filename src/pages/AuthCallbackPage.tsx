import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { clearInviteHandoff } from '@/lib/authHandoff';
import { exchangeDivineLoginCallback, parseDivineLoginCallback } from '@/lib/divineLogin';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useKeycastSession } from '@/hooks/useKeycastSession';

export default function AuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const loginActions = useLoginActions();
  const { saveBunkerUrl, saveSession } = useKeycastSession();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    let isCancelled = false;

    async function hydrateLogin() {
      try {
        const callback = parseDivineLoginCallback(`${window.location.origin}${location.pathname}${location.search}`);
        const result = await exchangeDivineLoginCallback(callback);

        if (result.token) {
          saveSession(result.token, null, false);
        }

        saveBunkerUrl(result.bunkerUri);
        await loginActions.bunker(result.bunkerUri);
        clearInviteHandoff();

        if (!isCancelled) {
          navigate(result.returnPath || '/home', { replace: true });
        }
      } catch (caughtError) {
        if (!isCancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to finish sign-in');
        }
      }
    }

    void hydrateLogin();

    return () => {
      isCancelled = true;
    };
  }, [location.pathname, location.search, loginActions, navigate, saveBunkerUrl, saveSession]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-4 rounded-3xl border bg-card p-6 shadow-sm">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button asChild className="w-full rounded-full">
            <Link to="/">Return to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-3 rounded-3xl border bg-card p-6 text-center shadow-sm">
        <p className="text-lg font-semibold">Finishing sign-in</p>
        <p className="text-sm text-muted-foreground">
          Restoring your signing session and bringing you back into Divine.
        </p>
      </div>
    </div>
  );
}
