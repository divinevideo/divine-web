import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { FullscreenFeed } from '@/components/FullscreenFeed';
import { AppSidebar } from '@/components/AppSidebar';
import { useAppContext } from '@/hooks/useAppContext';
import { useFullscreenFeed } from '@/contexts/FullscreenFeedContext';
import { getSubdomainUser } from '@/hooks/useSubdomainUser';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  clearCompilationPlaybackParams,
  parseCompilationPlaybackParams,
} from '@/lib/compilationPlayback';

export function AppLayout() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useCurrentUser();
  const { isRecording } = useAppContext();
  const { state: fullscreenState, exitFullscreen, onLoadMore, hasMore } = useFullscreenFeed();
  const compilationRequest = parseCompilationPlaybackParams(searchParams);

  const isLoggedIn = Boolean(user);

  // Hide header/sidebar on landing page (when logged out on root path), but NOT on subdomain profiles
  const isLandingPage = location.pathname === '/' && !isLoggedIn && !getSubdomainUser();

  const handleCloseFullscreen = () => {
    exitFullscreen();

    if (!compilationRequest.play) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    clearCompilationPlaybackParams(nextParams);
    setSearchParams(nextParams, { replace: true });
  };

  const handleCompilationVideoChange = (videoId: string) => {
    if (!compilationRequest.play) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('video', videoId);
    nextParams.delete('start');
    setSearchParams(nextParams, { replace: true });
  };

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
          onClose={handleCloseFullscreen}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
          autoAdvance={compilationRequest.play}
          onVideoChange={handleCompilationVideoChange}
        />
      )}
    </>
  );
}

export default AppLayout;
