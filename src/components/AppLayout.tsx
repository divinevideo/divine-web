import { Outlet, useLocation } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { ImmersiveTopBar } from '@/components/ImmersiveTopBar';
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

  // Determine top bar title and variant based on route
  const getTopBarConfig = (): { title: string; variant: 'transparent' | 'solid' } => {
    const path = location.pathname;
    if (path === '/' || path === '/home') return { title: 'Home', variant: 'transparent' };
    if (path.startsWith('/discovery')) return { title: 'Discover', variant: 'solid' };
    if (path.startsWith('/search')) return { title: 'Search', variant: 'solid' };
    if (path.startsWith('/notifications')) return { title: 'Notifications', variant: 'solid' };
    if (path.startsWith('/profile')) return { title: 'Profile', variant: 'solid' };
    if (path.startsWith('/hashtag')) return { title: 'Hashtag', variant: 'solid' };
    if (path.startsWith('/category')) return { title: 'Category', variant: 'solid' };
    if (path.startsWith('/settings')) return { title: 'Settings', variant: 'solid' };
    return { title: 'diVine', variant: 'solid' };
  };

  const topBarConfig = getTopBarConfig();

  return (
    <>
      {/* Sidebar - desktop only (fixed position), hidden on landing page */}
      {!isLandingPage && <AppSidebar className="hidden lg:flex" />}

      {/* Main content area - offset by sidebar width on desktop */}
      <div className={`flex min-h-screen flex-col bg-background ${!isLandingPage ? 'lg:ml-[240px]' : ''}`}>
        {/* ImmersiveTopBar - mobile/tablet only (< lg), hidden on landing page */}
        {!isLandingPage && (
          <ImmersiveTopBar
            title={topBarConfig.title}
            variant={topBarConfig.variant}
          />
        )}

        {/* Main content */}
        <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
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
