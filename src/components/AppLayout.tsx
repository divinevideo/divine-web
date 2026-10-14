import { useCallback } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { FullscreenFeed } from '@/components/FullscreenFeed';
import { AppSidebar } from '@/components/AppSidebar';
import { useAppContext } from '@/hooks/useAppContext';
import { useFullscreenFeed } from '@/contexts/FullscreenFeedContext';
import {
  clearCompilationPlaybackParams,
  parseCompilationPlaybackParams,
} from '@/lib/compilationPlayback';

export function AppLayout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isRecording } = useAppContext();
  const { state: fullscreenState, exitFullscreen, onLoadMore, hasMore } = useFullscreenFeed();
  const compilationRequest = parseCompilationPlaybackParams(searchParams);

  const handleCloseFullscreen = useCallback(() => {
    exitFullscreen();

    const currentRequest = parseCompilationPlaybackParams(searchParams);
    if (!currentRequest.play) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    clearCompilationPlaybackParams(nextParams);
    setSearchParams(nextParams, { replace: true });
  }, [exitFullscreen, searchParams, setSearchParams]);

  const handleCompilationVideoChange = useCallback((videoId: string) => {
    const currentRequest = parseCompilationPlaybackParams(searchParams);
    if (!currentRequest.play) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('video', videoId);
    nextParams.delete('start');
    if (nextParams.toString() === searchParams.toString()) {
      return;
    }

    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <>
      {/* Sidebar - desktop only (fixed position) */}
      <AppSidebar className="hidden md:flex" />

      {/* Main content area - offset by sidebar width on desktop */}
      <div className="flex min-h-screen flex-col bg-background md:ml-[240px]">
        {/* Header - mobile only (sidebar replaces it on desktop) */}
        <AppHeader className="md:hidden" />

        {/* Main content */}
        <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </main>

        {/* Bottom nav - mobile only */}
        {!isRecording && <BottomNav />}

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
