// ABOUTME: Fallback page when deep links don't open the Divine app
// ABOUTME: Handles OAuth callbacks, email verification, and other app links

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { detectPlatform, type Platform } from '@/lib/detectPlatform';
import { buildStoreLinks } from '@/lib/mobileStoreLinks';

const STORE_LINKS = buildStoreLinks('app_callback', 'app_callback');

export function AppCallbackPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const [platform] = useState<Platform>(detectPlatform);
  const [triedIntent, setTriedIntent] = useState(false);
  const { t } = useTranslation();

  // On Android, attempt intent:// with fallback
  useEffect(() => {
    if (platform === 'android' && code && !triedIntent) {
      setTriedIntent(true);

      // Use S.browser_fallback_url to prevent redirect loops
      // If app not installed, Android will go to Play Store instead of looping
      const fallbackUrl = encodeURIComponent(STORE_LINKS.playStore);
      const intentUrl = `intent://divine.video/app/callback?code=${encodeURIComponent(code)}#Intent;scheme=https;package=co.openvine.app;S.browser_fallback_url=${fallbackUrl};end`;

      window.location.href = intentUrl;
    }
  }, [platform, code, triedIntent]);

  // Desktop users
  if (platform === 'desktop') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">{t('appCallbackPage.desktop.heading')}</h1>
          <p className="text-muted-foreground">
            {t('appCallbackPage.desktop.body1')}
          </p>
          <p className="text-muted-foreground">
            {t('appCallbackPage.desktop.body2')}
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <a
              href={STORE_LINKS.appStore}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              {t('appCallbackPage.appStore')}
            </a>
            <a
              href={STORE_LINKS.playStore}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              {t('appCallbackPage.googlePlay')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Mobile users (iOS or Android after intent attempt)
  const storeUrl = platform === 'ios' ? STORE_LINKS.appStore : STORE_LINKS.playStore;
  const storeName = platform === 'ios' ? t('appCallbackPage.appStore') : t('appCallbackPage.googlePlay');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-2xl font-bold">{t('appCallbackPage.mobile.heading')}</h1>
        <p className="text-muted-foreground">
          {t('appCallbackPage.mobile.body')}
        </p>
        <ul className="text-left text-muted-foreground space-y-2 pl-4">
          <li>{t('appCallbackPage.mobile.bullet1')}</li>
          <li>{t('appCallbackPage.mobile.bullet2')}</li>
        </ul>
        <a
          href={storeUrl}
          className="inline-block mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          {t('appCallbackPage.mobile.getDivine', { store: storeName })}
        </a>
        <p className="text-sm text-muted-foreground pt-4">
          {t('appCallbackPage.mobile.emailHint')}
        </p>
      </div>
    </div>
  );
}

export default AppCallbackPage;
