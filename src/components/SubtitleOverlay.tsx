// ABOUTME: Subtitle overlay component for video player
// ABOUTME: Listens to video timeupdate events and displays active VTT cue text

import { useState, useEffect, useCallback } from 'react';
import { getActiveCue, type VttCue } from '@/lib/vttParser';

interface SubtitleOverlayProps {
  videoElement: HTMLVideoElement | null;
  cues: VttCue[];
  visible: boolean;
}

export function SubtitleOverlay({ videoElement, cues, visible }: SubtitleOverlayProps) {
  const [text, setText] = useState<string | null>(null);

  const handleTimeUpdate = useCallback(() => {
    if (!videoElement) return;
    const cue = getActiveCue(cues, videoElement.currentTime);
    setText(cue?.text ?? null);
  }, [videoElement, cues]);

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

  return (
    <div className="absolute bottom-12 left-0 right-0 flex justify-center z-20 pointer-events-none px-4">
      <span className="bg-black/75 text-white text-sm rounded-md px-3 py-1.5 max-w-[90%] text-center leading-snug">
        {text}
      </span>
    </div>
  );
}
