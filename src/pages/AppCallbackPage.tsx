// ABOUTME: OAuth callback page for Divine mobile app deep links
// ABOUTME: Fallback when iOS Universal Links or Android App Links don't intercept

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const RETRY_DELAY_SECONDS = 3;
const MAX_RETRIES = 3;

export function AppCallbackPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const [retryCount, setRetryCount] = useState(0);
  const [countdown, setCountdown] = useState(RETRY_DELAY_SECONDS);

  useEffect(() => {
    const storedRetries = sessionStorage.getItem('app_callback_retries');
    const retries = storedRetries ? parseInt(storedRetries, 10) : 0;
    setRetryCount(retries);

    // On Android, if App Links didn't intercept, try intent:// URL
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid && code && retries < MAX_RETRIES) {
      sessionStorage.setItem('app_callback_retries', String(retries + 1));

      const intentUrl = `intent://divine.video/app/callback?code=${encodeURIComponent(code)}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;
      window.location.href = intentUrl;
    }
    // On iOS, Universal Links should have intercepted before reaching this page
  }, [code]);

  // Countdown and auto-retry
  useEffect(() => {
    if (retryCount >= MAX_RETRIES) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.location.reload();
          return RETRY_DELAY_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [retryCount]);

  // Clear retries when user navigates away
  useEffect(() => {
    return () => {
      sessionStorage.removeItem('app_callback_retries');
    };
  }, []);

  const handleManualRetry = () => {
    sessionStorage.removeItem('app_callback_retries');
    window.location.reload();
  };

  if (retryCount >= MAX_RETRIES) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">Open in Divine App</h1>
          <p className="text-muted-foreground">
            The app didn't open automatically. Please make sure Divine is installed.
          </p>
          <button
            onClick={handleManualRetry}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
          <p className="text-sm text-muted-foreground pt-4">
            If the app still doesn't open, try opening Divine manually and signing in again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-2xl font-bold">Redirecting to Divine app...</h1>
        <p className="text-muted-foreground">
          Retrying in {countdown} second{countdown !== 1 ? 's' : ''}...
        </p>
        <button
          onClick={handleManualRetry}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Retry now
        </button>
      </div>
    </div>
  );
}

export default AppCallbackPage;
