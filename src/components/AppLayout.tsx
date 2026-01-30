import { Outlet, useLocation } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { AppFooter } from '@/components/AppFooter';
import { BottomNav } from '@/components/BottomNav';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { FullscreenFeed } from '@/components/FullscreenFeed';
import { useNostrLogin } from '@nostrify/react/login';
import { useAppContext } from '@/hooks/useAppContext';
import { useFullscreenFeed } from '@/contexts/FullscreenFeedContext';

export function AppLayout() {
  const location = useLocation();
  const { logins } = useNostrLogin();
  const { isRecording } = useAppContext();
  const { state: fullscreenState, exitFullscreen, onLoadMore, hasMore } = useFullscreenFeed();

  // Only consider user logged in if they have active logins, not just a token
  const isLoggedIn = logins.length > 0;

  // Hide header on landing page (when logged out on root path)
  const isLandingPage = location.pathname === '/' && !isLoggedIn;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!isLandingPage && <AppHeader />}
      <div className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </div>
      <AppFooter />
      {!isLandingPage && !isRecording && <BottomNav />}
      <PWAInstallPrompt />

      {/* Fullscreen video feed overlay */}
      {fullscreenState.isOpen && (
        <FullscreenFeed
          videos={fullscreenState.videos}
          startIndex={fullscreenState.startIndex}
          onClose={exitFullscreen}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
        />
      )}
    </div>
  );
}

export default AppLayout;

