// ABOUTME: Context for managing fullscreen feed state across components
// ABOUTME: Allows VideoFeed and BottomNav to coordinate fullscreen mode

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import type { ParsedVideoData } from '@/types/video';

interface FullscreenFeedState {
  isOpen: boolean;
  videos: ParsedVideoData[];
  startIndex: number;
}

interface FullscreenFeedContextType {
  state: FullscreenFeedState;
  enterFullscreen: (videos: ParsedVideoData[], startIndex: number) => void;
  exitFullscreen: () => void;
  // For BottomNav to trigger fullscreen on current feed
  requestFullscreen: () => void;
  setVideosForFullscreen: (videos: ParsedVideoData[]) => void;
}

const FullscreenFeedContext = createContext<FullscreenFeedContextType | undefined>(undefined);

export function FullscreenFeedProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FullscreenFeedState>({
    isOpen: false,
    videos: [],
    startIndex: 0,
  });

  // Store current feed videos for when BottomNav requests fullscreen
  const [feedVideos, setFeedVideos] = useState<ParsedVideoData[]>([]);

  const enterFullscreen = useCallback((videos: ParsedVideoData[], startIndex: number) => {
    setState({
      isOpen: true,
      videos,
      startIndex,
    });
  }, []);

  const exitFullscreen = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  // Called by BottomNav to request fullscreen mode
  const requestFullscreen = useCallback(() => {
    if (feedVideos.length > 0) {
      enterFullscreen(feedVideos, 0);
    }
  }, [feedVideos, enterFullscreen]);

  // Called by VideoFeed to register its videos
  const setVideosForFullscreen = useCallback((videos: ParsedVideoData[]) => {
    setFeedVideos(videos);
  }, []);

  return (
    <FullscreenFeedContext.Provider
      value={{
        state,
        enterFullscreen,
        exitFullscreen,
        requestFullscreen,
        setVideosForFullscreen,
      }}
    >
      {children}
    </FullscreenFeedContext.Provider>
  );
}

export function useFullscreenFeed() {
  const context = useContext(FullscreenFeedContext);
  if (context === undefined) {
    throw new Error('useFullscreenFeed must be used within a FullscreenFeedProvider');
  }
  return context;
}
