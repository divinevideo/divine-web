// ABOUTME: OAuth callback page for Divine mobile app deep links
// ABOUTME: Fallback when iOS Universal Links or Android App Links don't intercept

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function AppCallbackPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');

  useEffect(() => {
    // On Android, if App Links didn't intercept, try intent:// URL
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid && code) {
      const intentUrl = `intent://divine.video/app/callback?code=${encodeURIComponent(code)}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;
      window.location.href = intentUrl;
    }
    // On iOS, Universal Links should have intercepted before reaching this page
  }, [code]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-2xl font-bold">Redirecting to Divine app...</h1>
        <p className="text-muted-foreground">
          If the app doesn't open automatically, please open Divine and try again.
        </p>
        <p className="text-sm text-muted-foreground">
          Make sure you have the Divine app installed.
        </p>
      </div>
    </div>
  );
}

export default AppCallbackPage;
