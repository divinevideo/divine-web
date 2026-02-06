import { Outlet } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { FullscreenFeed } from '@/components/FullscreenFeed';
import { AppSidebar } from '@/components/AppSidebar';
import { useAppContext } from '@/hooks/useAppContext';
import { useFullscreenFeed } from '@/contexts/FullscreenFeedContext';

export function AppLayout() {
  const { isRecording } = useAppContext();
  const { state: fullscreenState, exitFullscreen, onLoadMore, hasMore } = useFullscreenFeed();

  return (
    <>
      {/* Sidebar - desktop only (fixed position) */}
      <AppSidebar className="hidden md:flex" />

      {/* Main content area - offset by sidebar width on desktop */}
      <div className="flex min-h-screen flex-col bg-background md:ml-[240px]">
        {/* Header - mobile only */}
        <AppHeader className="md:hidden" />

        {/* Main content */}
        <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </main>

        {/* Bottom nav - mobile only (already has md:hidden internally) */}
        {!isRecording && <BottomNav />}

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
