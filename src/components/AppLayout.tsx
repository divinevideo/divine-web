import { Outlet, useLocation } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { FullscreenFeed } from '@/components/FullscreenFeed';
import { AppSidebar } from '@/components/AppSidebar';
import { useAppContext } from '@/hooks/useAppContext';
import { useFullscreenFeed } from '@/contexts/FullscreenFeedContext';
import { getSubdomainUser } from '@/hooks/useSubdomainUser';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function AppLayout() {
  const location = useLocation();
  const { user } = useCurrentUser();
  const { isRecording } = useAppContext();
  const { state: fullscreenState, exitFullscreen, onLoadMore, hasMore } = useFullscreenFeed();

  const isLoggedIn = Boolean(user);

  // Hide header/sidebar on landing page (when logged out on root path), but NOT on subdomain profiles
  const isLandingPage = location.pathname === '/' && !isLoggedIn && !getSubdomainUser();

  return (
    <>
      {/* Sidebar - desktop only (fixed position), hidden on landing page */}
      {!isLandingPage && <AppSidebar className="hidden md:flex" />}

      {/* Main content area - offset by sidebar width on desktop */}
      <div className={`flex min-h-screen flex-col bg-background ${!isLandingPage ? 'md:ml-[240px]' : ''}`}>
        {/* Header - mobile only (sidebar replaces it on desktop), hidden on landing page */}
        {!isLandingPage && <AppHeader className="md:hidden" />}

        {/* Main content */}
        <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </main>

        {/* Bottom nav - mobile only */}
        {!isLandingPage && !isRecording && <BottomNav />}

        <PWAInstallPrompt />
      </div>

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
    </>
  );
}

export default AppLayout;
