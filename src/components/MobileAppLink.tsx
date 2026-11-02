import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { APP_STORE_URL, detectMobilePlatform, PLAY_STORE_URL } from '@/lib/mobileStoreLinks';

interface StandaloneNavigator extends Navigator {
  standalone?: boolean;
}

export function MobileAppLink() {
  const { t } = useTranslation();
  const { user, isAuthPending } = useCurrentUser();
  const platform = detectMobilePlatform(window.navigator.userAgent);
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as StandaloneNavigator).standalone === true ||
    document.referrer.includes('android-app://');

  if (user || isAuthPending || platform === 'other' || isInstalled) return null;

  const href = platform === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
  const linkText = t('pwaInstallPrompt.getDivine');
  const storeName = t(platform === 'ios' ? 'pwaInstallPrompt.appStore' : 'pwaInstallPrompt.googlePlay');
  // The accessible name must contain the visible text so voice control can target it (WCAG 2.5.3).
  const ariaLabel = `${linkText} (${storeName})`;

  return (
    <p className="py-2 text-center text-sm text-muted-foreground">
      <a className="font-semibold text-foreground underline hover:text-foreground/80" href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>
        {linkText}
      </a>
    </p>
  );
}
