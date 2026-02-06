// ABOUTME: Auto-looping video player component for 6-second videos
// ABOUTME: Supports MP4 and GIF formats with preloading, seamless playback, and blurhash placeholders

import { useRef, useEffect, useState, forwardRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useInView } from 'react-intersection-observer';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAdultVerification, checkMediaAuth } from '@/hooks/useAdultVerification';
import { debugError, verboseLog } from '@/lib/debug';
import { BlurhashPlaceholder, isValidBlurhash } from '@/components/BlurhashImage';
import { AgeVerificationOverlay } from '@/components/AgeVerificationOverlay';
import { createAuthLoader } from '@/lib/hlsAuthLoader';
import { bandwidthTracker } from '@/lib/bandwidthTracker';
import Hls from 'hls.js';

// Maximum playback duration limit - videos loop back to start after this many seconds
const MAX_PLAYBACK_DURATION = 6.3;

interface VideoPlayerProps {
  videoId: string;
  src: string;
  hlsUrl?: string; // HLS manifest URL for adaptive bitrate streaming
  fallbackUrls?: string[];
  poster?: string;
  blurhash?: string; // Blurhash for progressive loading placeholder
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  onLoadStart?: () => void;
  onLoadedData?: () => void;
  onEnded?: () => void;
  onError?: () => void;
  preload?: 'none' | 'metadata' | 'auto';
  onVideoDimensions?: (dimensions: { width: number; height: number; isVertical: boolean }) => void;
  // Mobile-specific props
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onPinch?: (data: { scale: number; direction: 'in' | 'out' }) => void;
  onVolumeGesture?: (data: { direction: 'up' | 'down'; delta: number }) => void;
  onBrightnessGesture?: (data: { direction: 'up' | 'down'; delta: number }) => void;
  onOrientationChange?: (orientation: string) => void;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  touches: number;
  identifier: number;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  (
    {
      videoId,
      src,
      hlsUrl,
      fallbackUrls,
      poster,
      blurhash,
      className,
      autoPlay: _autoPlay = true,
      muted: _muted = true,
      onLoadStart,
      onLoadedData,
      onEnded,
      onError,
      preload: _preload = 'none', // Changed to 'none' for better performance
      onVideoDimensions,
      // Mobile-specific props
      onDoubleTap,
      onLongPress,
      onSwipeLeft,
      onSwipeRight,
      onPinch,
      onVolumeGesture,
      onBrightnessGesture,
      onOrientationChange,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [requiresAuth, setRequiresAuth] = useState(false);
    const [authCheckPending, setAuthCheckPending] = useState(true); // Start true, set false after check completes
    const [authRetryCount, setAuthRetryCount] = useState(0);
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
    const [allUrls, setAllUrls] = useState<string[]>([]);
    const [triedHls, setTriedHls] = useState(false); // Track if we've fallen back to HLS
    const isChangingMuteState = useRef(false);
    const blobUrlRef = useRef<string | null>(null); // Track blob URL for cleanup to prevent memory leaks

    // Adult verification hook
    const { isVerified: isAdultVerified, getAuthHeader } = useAdultVerification();

    // Mobile-specific state
    const [touchState, setTouchState] = useState<TouchState | null>(null);
    const [lastTapTime, setLastTapTime] = useState(0);
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

    const { activeVideoId, registerVideo, unregisterVideo, updateVideoVisibility, globalMuted } = useVideoPlayback();
    const isActive = activeVideoId === videoId;

    // Store context functions in refs to avoid unstable dependencies in setRefs callback
    // This prevents infinite loops when context functions change reference
    const registerVideoRef = useRef(registerVideo);
    const unregisterVideoRef = useRef(unregisterVideo);
    const globalMutedRef = useRef(globalMuted);

    // Keep refs updated with latest values
    registerVideoRef.current = registerVideo;
    unregisterVideoRef.current = unregisterVideo;
    globalMutedRef.current = globalMuted;

    // Get responsive layout class
    const getLayoutClass = useCallback(() => {
      if (typeof window === 'undefined') return 'desktop-layout';

      const width = window.innerWidth;
      if (width < 480) return 'phone-layout';
      if (width < 1024) return 'tablet-layout'; // Changed from 768 to 1024
      return 'desktop-layout';
    }, []);

    const [layoutClass] = useState(getLayoutClass);

    const isMobile = useIsMobile();

    // Use intersection observer to detect when video is in viewport
    // Use multiple thresholds to get more granular visibility updates
    const { ref: inViewRef, inView, entry } = useInView({
      threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0], // Multiple thresholds for granular tracking
      rootMargin: '0px', // No margin, we want exact visibility
      triggerOnce: false, // Allow re-triggering when scrolling
    });

    // Combine refs - minimize dependencies for stability
    // IMPORTANT: Use refs for context functions to keep this callback stable
    // and prevent infinite loops when context functions change reference
    const setRefs = useCallback(
      (node: HTMLVideoElement | null) => {
        verboseLog(`[VideoPlayer ${videoId}] setRefs called with node:`, node ? 'HTMLVideoElement' : 'null');

        // Set video ref
        videoRef.current = node;

        // Set intersection observer ref
        inViewRef(node);

        // Set forwarded ref
        if (ref) {
          if (typeof ref === 'function') {
            ref(node);
          } else if ('current' in ref) {
            (ref as React.MutableRefObject<HTMLVideoElement | null>).current = node;
          }
        }

        // Register/unregister video with context using refs (stable references)
        if (node) {
          verboseLog(`[VideoPlayer ${videoId}] Registering video element`);
          // Set initial muted state using ref
          node.muted = globalMutedRef.current;
          registerVideoRef.current(videoId, node);
        } else {
          verboseLog(`[VideoPlayer ${videoId}] Unregistering video element`);
          unregisterVideoRef.current(videoId);
        }
      },
      [videoId, inViewRef, ref] // Removed registerVideo, unregisterVideo, globalMuted - use refs instead
    );

    // Set container ref
    const setContainerRef = useCallback((node: HTMLDivElement | null) => {
      containerRef.current = node;
    }, []);

    // Handle visibility changes - report visibility ratio to context
    useEffect(() => {
      if (entry && !hasError) {
        const visibilityRatio = entry.intersectionRatio;
        verboseLog(`[VideoPlayer ${videoId}] Visibility: ${(visibilityRatio * 100).toFixed(1)}%`);
        updateVideoVisibility(videoId, visibilityRatio);
      } else if (!entry || !inView) {
        // Not visible at all
        updateVideoVisibility(videoId, 0);
      }
    }, [entry, inView, videoId, hasError, updateVideoVisibility]);

    // Update playing state based on active status and control video playback
    useEffect(() => {
      verboseLog(`[VideoPlayer ${videoId}] Active status changed: ${isActive}`);
      setIsPlaying(isActive);

      // Actually control the video element
      if (videoRef.current) {
        if (isActive && !isLoading && !hasError) {
          verboseLog(`[VideoPlayer ${videoId}] Starting playback`);
          // Ensure video is not already playing before calling play()
          if (videoRef.current.paused) {
            videoRef.current.play().catch((error) => {
              debugError(`[VideoPlayer ${videoId}] Failed to start playback:`, error);
              if (error.name === 'NotSupportedError') {
                handleError();
              }
            });
          }
        } else if (!isActive) {
          // ALWAYS pause when not active, regardless of loading state
          // This ensures only one video can play at a time
          verboseLog(`[VideoPlayer ${videoId}] Stopping playback`);
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }
    }, [isActive, videoId, isLoading, hasError]);

    // Sync video muted state with global muted state
    useEffect(() => {
      if (videoRef.current) {
        const video = videoRef.current;
        const shouldBePlayingCheck = isActive && !isLoading && !hasError;

        verboseLog(`[VideoPlayer ${videoId}] Syncing muted state to: ${globalMuted}, isActive: ${isActive}, shouldBePlaying: ${shouldBePlayingCheck}`);

        // Set flag to ignore pause events during mute state change
        isChangingMuteState.current = true;

        // Change muted state
        video.muted = globalMuted;

        // If this video should be playing (is active and ready), ensure it stays playing
        if (shouldBePlayingCheck) {
          // Use requestAnimationFrame to let browser process the mute change first
          requestAnimationFrame(() => {
            // Then use another one to ensure we're after any browser-triggered events
            requestAnimationFrame(() => {
              if (video.paused) {
                verboseLog(`[VideoPlayer ${videoId}] Video paused after mute change, resuming...`);
                video.play().catch(error => {
                  verboseLog(`[VideoPlayer ${videoId}] Failed to resume after mute change:`, error);
                  if (error.name === 'NotSupportedError') {
                    handleError();
                  }
                });
              }
              // Clear flag after we've handled playback
              isChangingMuteState.current = false;
            });
          });
        } else {
          // Not active, just clear the flag after events settle
          setTimeout(() => {
            isChangingMuteState.current = false;
          }, 100);
        }
      }
    }, [globalMuted, videoId, isActive, isLoading, hasError]);

    // Handle play/pause
    const togglePlay = useCallback(() => {
      verboseLog(`[VideoPlayer ${videoId}] togglePlay called, isPlaying: ${isPlaying}`);
      if (!videoRef.current) {
        verboseLog(`[VideoPlayer ${videoId}] No video ref available`);
        return;
      }

      if (isPlaying) {
        verboseLog(`[VideoPlayer ${videoId}] Pausing video`);
        videoRef.current.pause();
      } else {
        verboseLog(`[VideoPlayer ${videoId}] Attempting to play video`);
        videoRef.current.play().catch((error) => {
          debugError(`[VideoPlayer ${videoId}] Play failed:`, error);
          if (error.name === 'NotSupportedError') {
            handleError();
          }
          setIsPlaying(false);
        });
      }
      setIsPlaying(!isPlaying);
    }, [videoId, isPlaying]);







    // Touch gesture handlers
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
      if (!isMobile) return;

      // Check if touch started on a button (ignore control buttons)
      const target = e.target as HTMLElement;
      const isButton = target.closest('button');
      if (isButton) {
        return; // Don't handle touch gestures if touching a button
      }

      const touch = e.touches[0];
      const currentTime = Date.now();

      // Clear any existing long press timer
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }

      // Set up touch state
      setTouchState({
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: currentTime,
        touches: e.touches.length,
        identifier: touch.identifier,
      });

      // Start long press timer
      const timer = setTimeout(() => {
        onLongPress?.();
      }, 500);
      setLongPressTimer(timer);

    }, [isMobile, longPressTimer, onLongPress]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
      if (!isMobile || !touchState) return;

      // Check if touch is on a button (ignore control buttons)
      const target = e.target as HTMLElement;
      const isButton = target.closest('button');
      if (isButton) {
        return; // Don't handle touch gestures if touching a button
      }

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchState.startX;
      const deltaY = touch.clientY - touchState.startY;

      // Clear long press timer on movement
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }

      // Handle pinch gesture
      if (e.touches.length === 2 && touchState.touches === 1) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );

        // Calculate scale direction (simplified)
        const direction = distance > 100 ? 'out' : 'in';
        onPinch?.({ scale: distance / 100, direction });
      }

      // Handle volume/brightness gestures (vertical swipes)
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 30) {
        const containerWidth = containerRef.current?.clientWidth || 300;
        const isRightSide = touchState.startX > containerWidth / 2;
        const direction = deltaY > 0 ? 'down' : 'up';

        if (isRightSide) {
          onVolumeGesture?.({ direction, delta: Math.abs(deltaY) });
        } else {
          onBrightnessGesture?.({ direction, delta: Math.abs(deltaY) });
        }
      }
    }, [isMobile, touchState, longPressTimer, onPinch, onVolumeGesture, onBrightnessGesture]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
      if (!isMobile || !touchState) return;

      // Check if touch target is a button FIRST (ignore taps on control buttons)
      const target = e.target as HTMLElement;
      const isButton = target.closest('button');
      if (isButton) {
        // Clear any state and timers, but don't process any gestures
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          setLongPressTimer(null);
        }
        setTouchState(null);
        return; // Don't handle tap/swipe gestures if touching a button
      }

      // Clear long press timer
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }

      const currentTime = Date.now();
      const duration = currentTime - touchState.startTime;
      const deltaX = (e.changedTouches[0]?.clientX || touchState.startX) - touchState.startX;
      const deltaY = (e.changedTouches[0]?.clientY || touchState.startY) - touchState.startY;

      // Handle tap gesture
      if (duration < 300 && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
        const timeSinceLastTap = currentTime - lastTapTime;

        if (timeSinceLastTap < 300) {
          // Double tap
          onDoubleTap?.();
        } else {
          // Single tap - toggle play/pause
          togglePlay();
        }
        setLastTapTime(currentTime);
      }

      // Handle swipe gestures
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      }

      setTouchState(null);
    }, [isMobile, touchState, longPressTimer, lastTapTime, togglePlay, onDoubleTap, onSwipeLeft, onSwipeRight]);

    // Track load timing
    const loadStartTime = useRef<number | null>(null);

    // Handle video events
    const handleLoadStart = () => {
      loadStartTime.current = performance.now();
      verboseLog(`[VideoPlayer ${videoId}] Load started at ${loadStartTime.current.toFixed(2)}ms`);
      // Only show loading state if video hasn't loaded once yet
      if (!hasLoadedOnce) {
        setIsLoading(true);
      }
      setHasError(false);
      onLoadStart?.();
    };


    const handleLoadedData = () => {
      const loadEndTime = performance.now();
      const loadDuration = loadStartTime.current ? loadEndTime - loadStartTime.current : 0;
      verboseLog(`[VideoPlayer ${videoId}] Data loaded after ${loadDuration.toFixed(2)}ms`);
      verboseLog(`[VideoPlayer ${videoId}] Video URL: ${src}`);
      if (videoRef.current) {
        const width = videoRef.current.videoWidth;
        const height = videoRef.current.videoHeight;
        const isVertical = height > width;
        verboseLog(`[VideoPlayer ${videoId}] Video dimensions: ${width}x${height} (${isVertical ? 'vertical' : 'horizontal'})`);
        verboseLog(`[VideoPlayer ${videoId}] Video duration: ${videoRef.current.duration}s`);

        // Report dimensions to parent component
        onVideoDimensions?.({ width, height, isVertical });

        // Record bandwidth sample for adaptive quality selection
        // Try to get actual transfer size from Performance API first
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const videoEntry = entries.find(e =>
          (src && e.name.includes(src)) ||
          (hlsUrl && e.name.includes(hlsUrl))
        );

        if (videoEntry && videoEntry.transferSize > 0 && loadDuration > 0) {
          // Use actual transfer size from Performance API
          verboseLog(`[VideoPlayer ${videoId}] Recording bandwidth: ${videoEntry.transferSize} bytes in ${loadDuration.toFixed(0)}ms`);
          bandwidthTracker.recordLoad(videoEntry.transferSize, loadDuration);
        } else if (loadDuration > 0 && videoRef.current.duration > 0) {
          // Estimate based on video duration and typical bitrate
          // 720p ~2.5 Mbps = 312.5 KB/s, 480p ~1.5 Mbps = 187.5 KB/s
          // Use conservative estimate (480p) to avoid overestimating bandwidth
          const estimatedBytes = Math.round(videoRef.current.duration * 187500);
          verboseLog(`[VideoPlayer ${videoId}] Recording bandwidth (estimated): ${estimatedBytes} bytes in ${loadDuration.toFixed(0)}ms`);
          bandwidthTracker.recordLoad(estimatedBytes, loadDuration);
        }
      }

      // Mark as loaded and hide blurhash permanently
      setIsLoading(false);
      setHasLoadedOnce(true);

      // Emit first video load metric (only once)
      if (loadDuration > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('performance-metric', {
          detail: {
            firstVideoLoad: Math.round(loadDuration),
          }
        }));
      }

      setIsLoading(false);
      onLoadedData?.();
    };

    const handleError = useCallback(() => {
      debugError(`[VideoPlayer ${videoId}] Error loading video from URL index ${currentUrlIndex}: ${allUrls[currentUrlIndex]}`);

      // Try next fallback URL if available
      if (currentUrlIndex < allUrls.length - 1) {
        verboseLog(`[VideoPlayer ${videoId}] Trying fallback URL ${currentUrlIndex + 1}/${allUrls.length - 1}`);
        setCurrentUrlIndex(currentUrlIndex + 1);
        setIsLoading(true);
        setHasError(false);
      } else if (hlsUrl && !triedHls) {
        // All direct URLs failed, try HLS as last resort
        verboseLog(`[VideoPlayer ${videoId}] All direct URLs failed, trying HLS as fallback: ${hlsUrl}`);
        setTriedHls(true);
        setIsLoading(true);
        setHasError(false);
      } else {
        debugError(`[VideoPlayer ${videoId}] All URLs failed, no more fallbacks`);
        setIsLoading(false);
        setHasError(true);
        onError?.();
      }
    }, [videoId, currentUrlIndex, allUrls, hlsUrl, triedHls, onError]);

    const handleEnded = () => {
      verboseLog(`[VideoPlayer ${videoId}] Video ended, auto-looping`);
      onEnded?.();
      // Auto-loop by replaying
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch((error) => {
          debugError(`[VideoPlayer ${videoId}] Failed to loop video:`, error);
          if (error.name === 'NotSupportedError') {
            handleError();
          }
          setIsPlaying(false);
        });
      }
    };

    const handleTimeUpdate = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      if (video.currentTime >= MAX_PLAYBACK_DURATION) {
        video.currentTime = 0;
      }
    }, []);

    // Handle age verification completion - retry video load
    const handleAgeVerified = useCallback(() => {
      verboseLog(`[VideoPlayer ${videoId}] Age verified, retrying video load`);
      setRequiresAuth(false);
      setAuthCheckPending(false); // No need to re-check, user just verified
      setIsLoading(true);
      setHasError(false);
      setAuthRetryCount(prev => prev + 1);

      // Force re-load by resetting the URL index
      setCurrentUrlIndex(0);
    }, [videoId]);

    // Handle play/pause state changes
    const handlePlay = () => {
      verboseLog(`[VideoPlayer ${videoId}] Play event fired, isActive: ${isActive}`);
      // If this video started playing but it's not the active video, pause it immediately
      // This prevents multiple videos from playing simultaneously
      if (!isActive && videoRef.current) {
        verboseLog(`[VideoPlayer ${videoId}] Not active, pausing immediately`);
        videoRef.current.pause();
        return;
      }
      setIsPlaying(true);
    };
    const handlePause = () => {
      // Ignore pause events that occur during mute state changes
      if (isChangingMuteState.current) {
        verboseLog(`[VideoPlayer ${videoId}] Pause event fired (ignored - changing mute state)`);
        return;
      }
      verboseLog(`[VideoPlayer ${videoId}] Pause event fired`);
      setIsPlaying(false);
    };

    // Handle orientation changes
    useEffect(() => {
      if (!isMobile || !onOrientationChange) return;

      const handleOrientationChange = () => {
        const orientation = screen.orientation?.type || 'portrait-primary';
        onOrientationChange(orientation);
      };

      window.addEventListener('orientationchange', handleOrientationChange);

      return () => {
        window.removeEventListener('orientationchange', handleOrientationChange);
      };
    }, [isMobile, onOrientationChange]);



    // Initialize URLs array
    useEffect(() => {
      verboseLog(`[VideoPlayer ${videoId}] Initializing URLs - src: ${src}, fallbackUrls: ${JSON.stringify(fallbackUrls)}`);

      const urls: string[] = [];
      if (src) {
        urls.push(src);
      }
      if (fallbackUrls && fallbackUrls.length > 0) {
        urls.push(...fallbackUrls);
      }

      if (urls.length === 0) {
        debugError(`[VideoPlayer ${videoId}] No valid URLs provided!`);
        setHasError(true);
        return;
      }

      setAllUrls(urls);
      setCurrentUrlIndex(0);
      verboseLog(`[VideoPlayer ${videoId}] Initialized with ${urls.length} URLs (primary: ${!!src}, fallbacks: ${fallbackUrls?.length || 0})`);
    }, [src, fallbackUrls, videoId]);

    // Set video source - with HLS.js support for adaptive bitrate streaming
    useEffect(() => {
      const video = videoRef.current;
      // AbortController to cancel in-flight fetches when effect re-runs
      const abortController = new AbortController();

      if (!video) {
        verboseLog(`[VideoPlayer ${videoId}] Skipping source setup - no video element`);
        return;
      }

      // Skip if already showing auth required (prevent loops)
      if (requiresAuth) {
        verboseLog(`[VideoPlayer ${videoId}] Skipping source setup - auth required`);
        return;
      }

      // Cleanup previous HLS instance
      if (hlsRef.current) {
        verboseLog(`[VideoPlayer ${videoId}] Destroying previous HLS instance`);
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Preflight auth check for HLS URL
      const checkAuth = async () => {
        const urlToCheck = hlsUrl || allUrls[currentUrlIndex];
        if (urlToCheck && !isAdultVerified) {
          const { authorized, status } = await checkMediaAuth(urlToCheck);
          setAuthCheckPending(false);
          if (!authorized && (status === 401 || status === 403)) {
            verboseLog(`[VideoPlayer ${videoId}] Preflight check: auth required (${status})`);
            setRequiresAuth(true);
            setIsLoading(false);
            return false;
          }
        } else {
          // Already verified or no URL to check
          setAuthCheckPending(false);
        }
        return true;
      };

      // Run preflight check then load video
      checkAuth().then((authorized) => {
        if (!authorized) return;
        loadVideoSource();
      });

      function loadVideoSource() {
        if (!video) return; // Guard for TypeScript - video was checked before calling
        verboseLog(`[VideoPlayer ${videoId}] loadVideoSource called - isAdultVerified: ${isAdultVerified}, authRetryCount: ${authRetryCount}`);

      // Priority: HLS URL > fallback URLs > primary src
      // Try HLS first for adaptive bitrate streaming on slower connections
      if (hlsUrl && Hls.isSupported()) {
        verboseLog(`[VideoPlayer ${videoId}] Using HLS.js for adaptive streaming: ${hlsUrl}`);

        // Use custom auth loader if adult verified - generates fresh NIP-98 signature for each request
        const hlsConfig: Partial<Hls['config']> = {
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          // Start with lower quality for faster initial load
          startLevel: -1, // Auto-select starting quality
          capLevelToPlayerSize: true, // Match quality to player size
        };

        // Add custom auth loader if adult verified
        if (isAdultVerified) {
          verboseLog(`[VideoPlayer ${videoId}] Using NIP-98 auth loader for each HLS request`);
          hlsConfig.loader = createAuthLoader(getAuthHeader);
        }

        const hls = new Hls(hlsConfig);

        hls.loadSource(hlsUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          verboseLog(`[VideoPlayer ${videoId}] HLS manifest parsed, ${hls.levels.length} quality levels available`);
          setIsLoading(false);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          debugError(`[VideoPlayer ${videoId}] HLS error:`, data);

          // Check for 401/403 auth errors
          if (data.response && (data.response.code === 401 || data.response.code === 403)) {
            debugError(`[VideoPlayer ${videoId}] Auth required (${data.response.code})`);
            setRequiresAuth(true);
            setIsLoading(false);
            hls.destroy();
            return;
          }

          if (data.fatal) {
            debugError(`[VideoPlayer ${videoId}] Fatal HLS error, falling back to direct playback`);
            hls.destroy();
            // Fall back to direct src playback
            const currentUrl = allUrls[currentUrlIndex];
            if (currentUrl) {
              video.src = currentUrl;
            }
          }
        });

        hlsRef.current = hls;
        setIsLoading(true);
        setHasError(false);

      } else if (hlsUrl && video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        verboseLog(`[VideoPlayer ${videoId}] Using native HLS support: ${hlsUrl}`);
        video.src = hlsUrl;
        setIsLoading(true);
        setHasError(false);

      } else {
        // Fall back to regular MP4 playback
        const currentUrl = allUrls[currentUrlIndex];
        verboseLog(`[VideoPlayer ${videoId}] Using direct playback - URL ${currentUrlIndex}/${allUrls.length - 1}: ${currentUrl}`);

        if (currentUrl) {
          // If adult verified, fetch with auth headers and use blob URL
          if (isAdultVerified) {
            verboseLog(`[VideoPlayer ${videoId}] Fetching MP4 with NIP-98 auth`);
            (async () => {
              try {
                const authHeader = await getAuthHeader(currentUrl);
                // Check if request was aborted while getting auth header
                if (abortController.signal.aborted) {
                  verboseLog(`[VideoPlayer ${videoId}] Fetch aborted before starting`);
                  return;
                }
                if (authHeader) {
                  const response = await fetch(currentUrl, {
                    headers: { 'Authorization': authHeader },
                    signal: abortController.signal
                  });
                  if (response.ok) {
                    const blob = await response.blob();
                    // Check if request was aborted while getting blob
                    if (abortController.signal.aborted) {
                      verboseLog(`[VideoPlayer ${videoId}] Fetch aborted after getting blob`);
                      return;
                    }
                    // Revoke any previous blob URL before creating a new one
                    if (blobUrlRef.current) {
                      URL.revokeObjectURL(blobUrlRef.current);
                    }
                    const blobUrl = URL.createObjectURL(blob);
                    blobUrlRef.current = blobUrl; // Store for cleanup on unmount
                    video.src = blobUrl;
                    video.onloadeddata = () => {
                      verboseLog(`[VideoPlayer ${videoId}] MP4 blob loaded successfully`);
                    };
                  } else if (response.status === 401 || response.status === 403) {
                    debugError(`[VideoPlayer ${videoId}] Auth failed even with NIP-98 (${response.status})`);
                    setRequiresAuth(true);
                    setIsLoading(false);
                  } else {
                    debugError(`[VideoPlayer ${videoId}] Fetch failed: ${response.status}`);
                    setHasError(true);
                    setIsLoading(false);
                  }
                } else {
                  // No auth header available, try without
                  video.src = currentUrl;
                }
              } catch (error) {
                // Ignore abort errors, they're expected when effect re-runs
                if (error instanceof Error && error.name === 'AbortError') {
                  verboseLog(`[VideoPlayer ${videoId}] Fetch aborted`);
                  return;
                }
                debugError(`[VideoPlayer ${videoId}] Fetch error:`, error);
                setHasError(true);
                setIsLoading(false);
              }
            })();
          } else {
            video.src = currentUrl;
          }
          setIsLoading(true);
          setHasError(false);
        }
      }
      } // end loadVideoSource

      // Cleanup on effect re-run or unmount
      return () => {
        // Abort any in-flight fetch to prevent race conditions with blob URLs
        abortController.abort();
        if (hlsRef.current) {
          verboseLog(`[VideoPlayer ${videoId}] Cleaning up HLS instance`);
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };

    }, [hlsUrl, currentUrlIndex, allUrls, videoId, requiresAuth, isAdultVerified, authRetryCount, getAuthHeader]); // React to HLS URL, fallback, and auth changes

    // Cleanup on unmount
    useEffect(() => {
      verboseLog(`[VideoPlayer ${videoId}] Component mounting`);
      return () => {
        verboseLog(`[VideoPlayer ${videoId}] Component unmounting`);

        // Ensure video is paused before unmounting
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }

        // Clear visibility and unregister
        updateVideoVisibility(videoId, 0);
        unregisterVideo(videoId);

        // Clean up timers
        if (longPressTimer) clearTimeout(longPressTimer);

        // Revoke blob URL to prevent memory leaks
        if (blobUrlRef.current) {
          verboseLog(`[VideoPlayer ${videoId}] Revoking blob URL on unmount`);
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      };
    }, [videoId, unregisterVideo, updateVideoVisibility, longPressTimer]);

    // Handle GIF format (use img tag)
    const currentUrl = allUrls[currentUrlIndex] || src;
    if (currentUrl.toLowerCase().endsWith('.gif')) {
      return (
        <div className={cn('relative overflow-hidden', className)}>
          <img
            src={currentUrl}
            alt="Video GIF"
            className="w-full h-full object-contain"
            onLoad={() => setIsLoading(false)}
            onError={() => setHasError(true)}
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="w-8 h-8 border-2 border-brand-light-green border-t-brand-green rounded-full animate-spin" />
            </div>
          )}
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              Failed to load GIF
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        ref={setContainerRef}
        className={cn(
          'relative overflow-hidden group',
          layoutClass,
          className
        )}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        {/* Blurhash placeholder - shows behind video while loading, hidden permanently after first load */}
        {isValidBlurhash(blurhash) && !hasLoadedOnce && (
          <BlurhashPlaceholder
            blurhash={blurhash}
            className={cn(
              'transition-opacity duration-300',
              !isLoading && !hasError ? 'opacity-0' : 'opacity-100'
            )}
          />
        )}

        <video
          ref={setRefs}
          // Don't set src directly if using HLS.js - it will handle the source
          // HLS.js is used when hlsUrl is provided and Hls.isSupported()
          // Only show poster after auth check passes - prevents 401 errors from poster URL
          // During auth check, blurhash provides the visual placeholder
          poster={(requiresAuth || authCheckPending) ? undefined : poster}
          muted // Start muted, will be controlled via effect
          autoPlay={false} // Never autoplay, we control playback programmatically
          loop
          playsInline
          // Preload based on visibility, but once loaded, keep preload stable to avoid re-fetching
          // hasLoadedOnce prevents the preload attribute from changing and causing flashes
          preload={hasLoadedOnce ? 'auto' : (inView ? 'auto' : 'metadata')}
          crossOrigin="anonymous"
          disableRemotePlayback
          className={cn(
            'w-full h-full object-contain relative z-10 bg-transparent',
            // Only use opacity transition on initial load, not on subsequent visibility changes
            !hasLoadedOnce && 'transition-opacity duration-300',
            !hasLoadedOnce && isLoading ? 'opacity-0' : 'opacity-100'
          )}
          onLoadStart={handleLoadStart}
          onLoadedData={handleLoadedData}
          onError={handleError}
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onClick={!isMobile ? togglePlay : undefined}
        />

        {/* Loading state - show loading animation over blurhash, only on initial load */}
        {isLoading && !hasLoadedOnce && (
          <div
            className="absolute inset-0 flex items-center justify-center z-20"
            data-testid={isMobile ? "mobile-loading" : undefined}
          >
            {/* Only show black bg if no blurhash, otherwise let blurhash show through */}
            {!isValidBlurhash(blurhash) && (
              <div className='absolute w-full h-full bg-black'></div>
            )}
            <img
              src="/ui-icons/loading-brand.svg"
              alt="Loading..."
              className="w-24 h-24 opacity-75"
            />
          </div>
        )}

        {/* Error state */}
        {hasError && !requiresAuth && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div>Failed to load video</div>
              {isMobile && (
                <div className="text-sm mt-2">Tap to retry</div>
              )}
            </div>
          </div>
        )}

        {/* Age verification required (401/403) */}
        {requiresAuth && (
          <AgeVerificationOverlay
            onVerified={handleAgeVerified}
            thumbnailUrl={poster}
            blurhash={blurhash}
          />
        )}
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

// Add CSS for responsive layouts
const styles = `
  .phone-layout {
    @apply max-w-full;
  }

  .tablet-layout {
    @apply max-w-2xl;
  }

  .desktop-layout {
    @apply max-w-4xl;
  }

  .mobile-controls.p-4 {
    padding: 1rem;
  }

  .min-h-\\[44px\\] {
    min-height: 44px;
  }
`;

// Inject styles if not already injected
if (typeof document !== 'undefined' && !document.getElementById('video-player-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'video-player-styles';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
