// ABOUTME: Context for managing video playback state across the feed
// ABOUTME: Ensures only one video plays at a time based on viewport visibility

import { createContext, useState, useRef, ReactNode } from 'react';
import { verboseLog } from '@/lib/debug';

// Maximum number of video references to keep in memory
// Older entries are pruned when this limit is exceeded
const MAX_VIDEO_REFS = 30;

export interface VideoPlaybackContextType {
  activeVideoId: string | null;
  setActiveVideo: (videoId: string | null) => void;
  registerVideo: (videoId: string, element: HTMLVideoElement) => void;
  unregisterVideo: (videoId: string) => void;
  updateVideoVisibility: (videoId: string, visibilityRatio: number) => void;
  globalMuted: boolean;
  setGlobalMuted: (muted: boolean) => void;
}

export const VideoPlaybackContext = createContext<VideoPlaybackContextType | undefined>(undefined);

export function VideoPlaybackProvider({ children }: { children: ReactNode }) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [globalMuted, setGlobalMuted] = useState(true); // Start muted by default
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const videoVisibility = useRef<Map<string, number>>(new Map());
  // Track registration order for LRU-style pruning
  const registrationOrder = useRef<string[]>([]);
  const visibilityUpdateTimer = useRef<NodeJS.Timeout | null>(null);
  // Track activeVideoId in a ref to avoid stale closure issues in debounced callbacks
  const activeVideoIdRef = useRef<string | null>(null);
  activeVideoIdRef.current = activeVideoId;

  const setActiveVideo = (videoId: string | null) => {
    verboseLog(`setActiveVideo called with: ${videoId}, current: ${activeVideoId}`);
    verboseLog(`Registered videos: ${Array.from(videoRefs.current.keys()).join(', ')}`);

    // Just update the active video ID
    // The VideoPlayer components will handle play/pause based on this change
    setActiveVideoId(videoId);
  };

  const registerVideo = (videoId: string, element: HTMLVideoElement) => {
    verboseLog(`Registering video: ${videoId}`);

    // Add to registration order (move to end if already exists)
    const orderIndex = registrationOrder.current.indexOf(videoId);
    if (orderIndex !== -1) {
      registrationOrder.current.splice(orderIndex, 1);
    }
    registrationOrder.current.push(videoId);

    videoRefs.current.set(videoId, element);

    // Prune oldest entries if we exceed the limit
    while (registrationOrder.current.length > MAX_VIDEO_REFS) {
      const oldestId = registrationOrder.current.shift();
      if (oldestId && oldestId !== activeVideoIdRef.current) {
        verboseLog(`Pruning old video ref: ${oldestId}`);
        videoRefs.current.delete(oldestId);
        videoVisibility.current.delete(oldestId);
      }
    }
  };

  const unregisterVideo = (videoId: string) => {
    verboseLog(`Unregistering video: ${videoId}`);
    videoRefs.current.delete(videoId);
    videoVisibility.current.delete(videoId);

    // Remove from registration order
    const orderIndex = registrationOrder.current.indexOf(videoId);
    if (orderIndex !== -1) {
      registrationOrder.current.splice(orderIndex, 1);
    }
  };

  const updateVideoVisibility = (videoId: string, visibilityRatio: number) => {
    // Update visibility for this video
    if (visibilityRatio > 0) {
      videoVisibility.current.set(videoId, visibilityRatio);
    } else {
      videoVisibility.current.delete(videoId);
    }

    // Debounce the selection of most visible video
    if (visibilityUpdateTimer.current) {
      clearTimeout(visibilityUpdateTimer.current);
    }

    visibilityUpdateTimer.current = setTimeout(() => {
      // Find the most visible video
      let mostVisibleId: string | null = null;
      let maxVisibility = 0;

      videoVisibility.current.forEach((ratio, id) => {
        if (ratio > maxVisibility) {
          maxVisibility = ratio;
          mostVisibleId = id;
        }
      });

      // Only update if there's a visible video and it's different from current
      // Use ref to get current value and avoid stale closure
      if (mostVisibleId !== activeVideoIdRef.current) {
        verboseLog(`Switching to most visible video: ${mostVisibleId} (${(maxVisibility * 100).toFixed(1)}% visible)`);
        setActiveVideoId(mostVisibleId);
      }
    }, 100); // Small debounce to avoid rapid switching
  };

  return (
    <VideoPlaybackContext.Provider
      value={{
        activeVideoId,
        setActiveVideo,
        registerVideo,
        unregisterVideo,
        updateVideoVisibility,
        globalMuted,
        setGlobalMuted,
      }}
    >
      {children}
    </VideoPlaybackContext.Provider>
  );
}