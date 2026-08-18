import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { DownloadSimple as Download, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/mobileStoreLinks';

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export function PWAInstallPrompt({ delayMs = 10000 }: { delayMs?: number } = {}) {
  const { t } = useTranslation();
  const location = useLocation();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasLeftLanding, setHasLeftLanding] = useState(false);

  const showAppStore = !isAndroid;
  const showGooglePlay = !isIOS;

  // Track when user leaves the landing page
  useEffect(() => {
    if (location.pathname !== '/') {
      setHasLeftLanding(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    // Check if mobile device
    const checkMobile = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isMobileDevice = /iphone|ipad|ipod|android|mobile/.test(userAgent);
      const isSmallScreen = window.innerWidth < 768; // md breakpoint
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    checkMobile();

    // Re-check on resize
    const handleResize = () => checkMobile();
    window.addEventListener('resize', handleResize);

    // Check if running as installed PWA
    const checkStandalone = () => {
      const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        navigatorWithStandalone.standalone === true ||
        document.referrer.includes('android-app://');

      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Check if iOS
    const checkIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isIOSDevice);
      setIsAndroid(/android/.test(userAgent));
    };

    checkIOS();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Show prompt after user has been on a non-landing page for 10 seconds
  useEffect(() => {
    if (!hasLeftLanding) return;
    if (location.pathname === '/') return; // Don't show on landing page even after returning

    const timer = setTimeout(() => {
      // Check if user hasn't dismissed this before
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setShowPrompt(true);
      }
    }, delayMs); // Show after 10 seconds on non-landing page

    return () => clearTimeout(timer);
  }, [hasLeftLanding, location.pathname, delayMs]);

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for this session
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if already installed or on desktop
  if (isStandalone || !isMobile) {
    return null;
  }

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-background border-2 border-primary rounded-lg shadow-lg p-4 animate-in slide-in-from-bottom-4">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 hover:bg-accent rounded-full transition-colors"
        aria-label={t('pwaInstallPrompt.close')}
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
          <Download className="h-5 w-5 text-primary-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground mb-1">
            {t('pwaInstallPrompt.getDivine')}
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            {t('pwaInstallPrompt.descriptionNative')}
          </p>

          {/*
            flex-1 without min-w-0: the buttons share the row when the labels
            fit and the row wraps when they do not. With min-w-0 they shrank
            under their own `whitespace-nowrap` text instead, spilling the label
            outside the pill.
          */}
          <div className="flex flex-wrap gap-2">
            {showAppStore && (
              <Button asChild size="sm" className="flex-1">
                <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label={t('pwaInstallPrompt.appStoreAria')}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('pwaInstallPrompt.appStore')}
                </a>
              </Button>
            )}
            {showGooglePlay && (
              <Button asChild size="sm" className="flex-1">
                <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label={t('pwaInstallPrompt.googlePlayAria')}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('pwaInstallPrompt.googlePlay')}
                </a>
              </Button>
            )}
            <Button
              onClick={handleDismiss}
              size="sm"
              variant="outline"
            >
              {t('pwaInstallPrompt.notNow')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
