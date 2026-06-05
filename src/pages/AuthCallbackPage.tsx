import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useDivineSession } from '@/hooks/useDivineSession';
import { clearInviteHandoff } from '@/lib/authHandoff';
import { exchangeDivineLoginCallback, parseDivineLoginCallback } from '@/lib/divineLogin';

export default function AuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { saveSession } = useDivineSession();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const { t } = useTranslation();

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

        clearInviteHandoff();

        if (!isCancelled) {
          navigate(result.returnPath || '/home', { replace: true });
        }
      } catch (caughtError) {
        if (!isCancelled) {
          setError(caughtError instanceof Error ? caughtError.message : t('authCallbackPage.failedToFinish'));
        }
      }
    }

    void hydrateLogin();

    return () => {
      isCancelled = true;
    };
  }, [location.pathname, location.search, navigate, saveSession, t]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-4 rounded-3xl border bg-card p-6 shadow-sm">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button asChild className="w-full rounded-full">
            <Link to="/">{t('authCallbackPage.returnToSignIn')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-3 rounded-3xl border bg-card p-6 text-center shadow-sm">
        <p className="text-lg font-semibold">{t('authCallbackPage.finishingSignIn')}</p>
        <p className="text-sm text-muted-foreground">
          {t('authCallbackPage.restoring')}
        </p>
      </div>
    </div>
  );
}
