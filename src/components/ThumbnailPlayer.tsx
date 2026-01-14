// ABOUTME: Thumbnail display component for video previews in feeds
// ABOUTME: Shows poster image with play button overlay and click-to-play functionality

import { useState, useCallback } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAdultVerification, checkMediaAuth } from '@/hooks/useAdultVerification';
import { AgeVerificationOverlay } from '@/components/AgeVerificationOverlay';
import { verboseLog, debugError } from '@/lib/debug';

interface ThumbnailPlayerProps {
  videoId: string;
  src: string;
  thumbnailUrl?: string;
  duration?: number;
  className?: string;
  onClick?: () => void;
  onError?: () => void;
  onVideoDimensions?: (dimensions: { width: number; height: number; isVertical: boolean }) => void;
}

export function ThumbnailPlayer({
  videoId,
  src,
  thumbnailUrl,
  duration,
  className,
  onClick,
  onError,
  onVideoDimensions,
}: ThumbnailPlayerProps) {
  const [thumbnailError, setThumbnailError] = useState(false);
  const [useVideoFallback, setUseVideoFallback] = useState(false);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [authRetryKey, setAuthRetryKey] = useState(0);
  const { isVerified: isAdultVerified } = useAdultVerification();

  // Handle age verification completion - retry thumbnail load
  const handleAgeVerified = useCallback(() => {
    verboseLog(`[ThumbnailPlayer ${videoId}] Age verified, retrying thumbnail load`);
    setRequiresAuth(false);
    setThumbnailError(false);
    setUseVideoFallback(false);
    setAuthRetryKey(prev => prev + 1);
  }, [videoId]);

  const handleThumbnailError = useCallback(async () => {
    // If image fails, try video fallback first
    if (!useVideoFallback) {
      setUseVideoFallback(true);
      return;
    }

    // Both image and video fallback failed - check if it's auth-related
    const urlToCheck = thumbnailUrl || src;
    if (urlToCheck && !isAdultVerified) {
      verboseLog(`[ThumbnailPlayer ${videoId}] Thumbnail failed, checking if auth required`);
      const { authorized, status } = await checkMediaAuth(urlToCheck);
      if (!authorized && (status === 401 || status === 403)) {
        debugError(`[ThumbnailPlayer ${videoId}] Auth required (${status})`);
        setRequiresAuth(true);
        return;
      }
    }

    setThumbnailError(true);
    onError?.();
  }, [useVideoFallback, thumbnailUrl, src, isAdultVerified, videoId, onError]);

  const handleThumbnailLoad = (e: React.SyntheticEvent<HTMLVideoElement | HTMLImageElement>) => {
    
    // Detect video dimensions from loaded thumbnail
    const target = e.currentTarget;
    if (target instanceof HTMLVideoElement) {
      const width = target.videoWidth;
      const height = target.videoHeight;
      if (width > 0 && height > 0) {
        const isVertical = height > width;
        onVideoDimensions?.({ width, height, isVertical });
      }
    } else if (target instanceof HTMLImageElement) {
      const width = target.naturalWidth;
      const height = target.naturalHeight;
      if (width > 0 && height > 0) {
        const isVertical = height > width;
        onVideoDimensions?.({ width, height, isVertical });
      }
    }
  };

  const handleClick = () => {
    onClick?.();
  };

  // Generate thumbnail from video if no thumbnail URL provided
  const effectiveThumbnailUrl = thumbnailUrl || generateThumbnailFromVideo(src);

  // Check if the thumbnail URL is actually a video file or same as source
  const isVideoThumbnail = effectiveThumbnailUrl === src ||
    effectiveThumbnailUrl?.match(/\.(mp4|webm|mov|m3u8|mpd|avi|mkv|ogv|ogg)($|\?|#)/i) ||
    effectiveThumbnailUrl?.includes('/manifest/');

  return (
    <div
      className={cn(
        'relative aspect-square cursor-pointer group overflow-hidden',
        'hover:scale-105 transition-transform duration-200',
        className
      )}
      data-testid="thumbnail-container"
      onClick={handleClick}
    >
      {/* Age verification required (401/403) */}
      {requiresAuth ? (
        <AgeVerificationOverlay
          onVerified={handleAgeVerified}
          thumbnailUrl={thumbnailUrl}
        />
      ) : !thumbnailError && effectiveThumbnailUrl ? (
        /* Thumbnail image or video */
        isVideoThumbnail || useVideoFallback ? (
          <video
            key={`video-${authRetryKey}`}
            src={`${effectiveThumbnailUrl}#t=0.1`}
            className="w-full h-full object-cover"
            muted
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            data-testid="video-thumbnail"
            onLoadedData={handleThumbnailLoad}
            onError={handleThumbnailError}
          />
        ) : (
          <img
            key={`img-${authRetryKey}`}
            src={effectiveThumbnailUrl}
            alt="Video thumbnail"
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
            data-testid="video-thumbnail"
            onLoad={handleThumbnailLoad}
            onError={handleThumbnailError}
          />
        )
      ) : (
        <div
          className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-400"
          data-testid="thumbnail-placeholder"
        >
          <div className="text-center">
            <Play className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Video Preview</p>
          </div>
        </div>
      )}

      {/* Play button overlay - only show when not showing auth overlay */}
      {!requiresAuth && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            variant="ghost"
            size="icon"
            className="w-16 h-16 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
            data-testid="thumbnail-play-button"
            aria-label="Play video"
          >
            <Play className="h-8 w-8 ml-1" />
          </Button>
        </div>
      )}

    </div>
  );
}

// Simple thumbnail generation utility
// Uses video URL fragment to hint browsers to load a frame at 0.1 seconds
// This provides basic thumbnail support when explicit thumbnails are unavailable
function generateThumbnailFromVideo(videoUrl: string): string | null {
  if (!videoUrl) return null;
  return `${videoUrl}#t=0.1`; // Browser hint to load frame at 0.1 seconds
}