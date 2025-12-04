import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export function PWAInstallPrompt() {
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasLeftLanding, setHasLeftLanding] = useState(false);

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
    };

    checkIOS();

    // Listen for the beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
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
      if (!dismissed && (deferredPrompt || isIOS)) {
        setShowPrompt(true);
      }
    }, 10000); // Show after 10 seconds on non-landing page

    return () => clearTimeout(timer);
  }, [hasLeftLanding, location.pathname, deferredPrompt, isIOS]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[PWA] User accepted the install prompt');
    } else {
      console.log('[PWA] User dismissed the install prompt');
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for this session
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if already installed or on desktop
  if (isStandalone || !isMobile) {
    return null;
  }

  // Show iOS-specific instructions
  if (isIOS && !isStandalone) {
    // Only show on iOS Safari, not in other browsers
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (!isSafari || !showPrompt) {
      return null;
    }

    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 bg-background border-2 border-primary rounded-lg shadow-lg p-4 animate-in slide-in-from-bottom-4">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 hover:bg-accent rounded-full transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Download className="h-5 w-5 text-primary-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm mb-1">
              Install Rewind Web
            </h3>
            <p className="text-xs text-muted-foreground">
              Tap the Share button <span className="inline-block mx-1">
                <svg className="inline w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z"/>
                </svg>
              </span> then "Add to Home Screen"
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show Android/Desktop install prompt
  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-background border-2 border-primary rounded-lg shadow-lg p-4 animate-in slide-in-from-bottom-4">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 hover:bg-accent rounded-full transition-colors"
        aria-label="Close"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
          <Download className="h-5 w-5 text-primary-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground mb-1">
            Install Rewind Web
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Install our app for a better experience
          </p>

          <div className="flex gap-2">
            <Button
              onClick={handleInstallClick}
              size="sm"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Install
            </Button>
            <Button
              onClick={handleDismiss}
              size="sm"
              variant="outline"
            >
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
