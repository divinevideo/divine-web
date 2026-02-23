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
    <div className="absolute bottom-14 left-0 right-0 flex justify-center z-20 pointer-events-none px-6">
      <span
        className="bg-black/80 text-white text-[15px] font-medium rounded-lg px-4 py-2 max-w-[85%] text-center leading-relaxed drop-shadow-lg"
        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
      >
        {text}
      </span>
    </div>
  );
}
