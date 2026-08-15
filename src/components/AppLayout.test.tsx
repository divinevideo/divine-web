import { useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import type { ParsedVideoData } from '@/types/video';

const mockExitFullscreen = vi.fn();
const mockOnLoadMore = vi.fn();

const mockVideos = [
  { id: 'video-1' },
  { id: 'video-2' },
] as ParsedVideoData[];

vi.mock('@/components/AppHeader', () => ({
  AppHeader: () => <header>header</header>,
}));

vi.mock('@/components/BottomNav', () => ({
  BottomNav: () => <nav>bottom nav</nav>,
}));

vi.mock('@/components/PWAInstallPrompt', () => ({
  PWAInstallPrompt: () => null,
}));

vi.mock('@/components/AppSidebar', () => ({
  AppSidebar: () => <aside>sidebar</aside>,
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({ isRecording: false }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/useSubdomainUser', () => ({
  getSubdomainUser: () => null,
}));

vi.mock('@/contexts/FullscreenFeedContext', () => ({
  useFullscreenFeed: () => ({
    state: {
      isOpen: true,
      videos: mockVideos,
      startIndex: 0,
    },
    exitFullscreen: mockExitFullscreen,
    onLoadMore: mockOnLoadMore,
    hasMore: false,
  }),
}));

vi.mock('@/components/FullscreenFeed', () => ({
  FullscreenFeed: ({
    videos,
    onClose,
    onVideoChange,
  }: {
    videos: ParsedVideoData[];
    onClose: () => void;
    onVideoChange?: (videoId: string) => void;
  }) => {
    const lastReportedVideoIdRef = useRef<string>();

    useEffect(() => {
      const activeVideoId = videos[0]?.id;
      if (!activeVideoId || lastReportedVideoIdRef.current === activeVideoId) {
        return;
      }

      lastReportedVideoIdRef.current = activeVideoId;
      onVideoChange?.(activeVideoId);
    }, [onVideoChange, videos]);

    return (
      <div>
        <button type="button" onClick={onClose}>
          close fullscreen
        </button>
        <button type="button" onClick={() => onVideoChange?.('video-1')}>
          report video 1
        </button>
        <button type="button" onClick={() => onVideoChange?.('video-2')}>
          report video 2
        </button>
      </div>
    );
  },
}));

function renderLayout(path: string) {
  window.history.pushState(null, '', path);

  return render(
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/search" element={<main>search page</main>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

describe('AppLayout', () => {
  const originalReplaceState = window.history.replaceState;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.history.replaceState = originalReplaceState;
    window.history.pushState(null, '', '/');
  });

  it('does not rewrite the url when the compilation active video is already current', async () => {
    const user = userEvent.setup();
    const replaceStateSpy = vi.fn(originalReplaceState.bind(window.history));
    window.history.replaceState = replaceStateSpy;

    renderLayout('/search?q=x&play=compilation&video=video-1');
    replaceStateSpy.mockClear();

    // Re-report the already-current video: the handler must no-op rather than
    // rewrite the identical URL (the replaceState loop this fix prevents).
    await user.click(screen.getByRole('button', { name: 'report video 1' }));

    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it('rewrites the compilation video param once when the active video changes', async () => {
    const user = userEvent.setup();
    const replaceStateSpy = vi.fn(originalReplaceState.bind(window.history));
    window.history.replaceState = replaceStateSpy;

    renderLayout('/search?q=x&play=compilation&video=video-1');
    replaceStateSpy.mockClear();

    await user.click(screen.getByRole('button', { name: 'report video 2' }));

    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe('?q=x&play=compilation&video=video-2');
  });

  it('clears compilation playback params when fullscreen closes', async () => {
    const user = userEvent.setup();
    const replaceStateSpy = vi.fn(originalReplaceState.bind(window.history));
    window.history.replaceState = replaceStateSpy;

    renderLayout('/search?q=x&play=compilation&video=video-1');
    replaceStateSpy.mockClear();

    await user.click(screen.getByRole('button', { name: 'close fullscreen' }));

    expect(mockExitFullscreen).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe('?q=x');
  });
});
