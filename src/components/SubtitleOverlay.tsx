// ABOUTME: Subtitle overlay component for video player
// ABOUTME: Listens to video timeupdate events and displays active VTT cue text

import { useState, useEffect, useCallback } from 'react';
import { getActiveCue, type VttCue } from '@/lib/vttParser';

interface SubtitleOverlayProps {
  videoElement: HTMLVideoElement | null;
  cues: VttCue[];
  visible: boolean;
}

/**
 * Compute the visible video rect within its container when using object-contain.
 * Returns CSS values to constrain the overlay to the actual video area.
 */
function getVideoVisibleRect(video: HTMLVideoElement): { left: number; width: number } | null {
  if (!video.videoWidth || !video.videoHeight) return null;

  const containerWidth = video.clientWidth;
  const containerHeight = video.clientHeight;
  if (!containerWidth || !containerHeight) return null;

  const videoRatio = video.videoWidth / video.videoHeight;
  const containerRatio = containerWidth / containerHeight;

  if (videoRatio < containerRatio) {
    // Video is narrower than container (pillarboxed) — e.g. portrait video in landscape container
    const visibleWidth = containerHeight * videoRatio;
    const left = (containerWidth - visibleWidth) / 2;
    return { left, width: visibleWidth };
  }

  // Video fills width (letterboxed or exact fit)
  return { left: 0, width: containerWidth };
}

export function SubtitleOverlay({ videoElement, cues, visible }: SubtitleOverlayProps) {
  const [text, setText] = useState<string | null>(null);
  const [videoRect, setVideoRect] = useState<{ left: number; width: number } | null>(null);

  const handleTimeUpdate = useCallback(() => {
    if (!videoElement) return;
    const cue = getActiveCue(cues, videoElement.currentTime);
    setText(cue?.text ?? null);
  }, [videoElement, cues]);

  // Track the visible video area
  useEffect(() => {
    if (!videoElement) return;

    const updateRect = () => setVideoRect(getVideoVisibleRect(videoElement));

    // Update on loadeddata (when videoWidth/videoHeight are known) and resize
    videoElement.addEventListener('loadeddata', updateRect);
    window.addEventListener('resize', updateRect);
    updateRect();

    return () => {
      videoElement.removeEventListener('loadeddata', updateRect);
      window.removeEventListener('resize', updateRect);
    };
  }, [videoElement]);

  useEffect(() => {
    if (!videoElement || !visible || cues.length === 0) {
      setText(null);
      return;
    }

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    // Run once immediately in case video is already playing
    handleTimeUpdate();

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoElement, visible, cues, handleTimeUpdate]);

  if (!visible || !text) return null;

  // Constrain subtitle to the visible video area
  const style: React.CSSProperties = {
    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  };

  const containerStyle: React.CSSProperties = videoRect
    ? { left: videoRect.left, width: videoRect.width }
    : { left: 0, right: 0 };

  return (
    <div
      className="absolute bottom-14 flex justify-center z-20 pointer-events-none px-4"
      style={containerStyle}
    >
      <span
        className="bg-black/80 text-white text-[15px] font-medium rounded-lg px-4 py-2 max-w-[85%] text-center leading-relaxed drop-shadow-lg"
        style={style}
      >
        {text}
      </span>
    </div>
  );
}
