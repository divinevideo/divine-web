import { Outlet } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { FullscreenFeed } from '@/components/FullscreenFeed';
import { AppSidebar } from '@/components/AppSidebar';
import { useAppContext } from '@/hooks/useAppContext';
import { useFullscreenFeed } from '@/contexts/FullscreenFeedContext';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { isRecording } = useAppContext();
  const { state: fullscreenState, exitFullscreen, onLoadMore, hasMore } = useFullscreenFeed();

  // Root now renders public discovery, so keep the app shell for signed-out visitors too.
  const isLandingPage = false;

  return (
    <>
      {/* Sidebar - desktop only (fixed position), hidden on landing page */}
      {!isLandingPage && <AppSidebar className="hidden xl:flex" />}

      {/* Main content area - keep the app shell through tablet sizes */}
      <div
        className={cn(
          'relative isolate flex min-h-screen flex-col overflow-x-clip',
          !isLandingPage && 'xl:pl-80'
        )}
      >
        {/* Header - mobile and tablet, hidden on landing page */}
        {!isLandingPage && <AppHeader className="xl:hidden" />}

        {/* Main content */}
        <main className="flex-1 pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom)+1.5rem)] xl:pb-8">
          <Outlet />
        </main>

        {/* Bottom nav - mobile and tablet */}
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
