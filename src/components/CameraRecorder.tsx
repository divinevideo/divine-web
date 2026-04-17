// ABOUTME: Responsive camera recording component with Vine-style press-to-record interface
// ABOUTME: Mobile-first design with desktop modal, proper aspect ratios, and touch-friendly controls

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, Repeat, X } from '@phosphor-icons/react';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { useAppContext } from '@/hooks/useAppContext';
import { cn } from '@/lib/utils';

interface CameraRecorderProps {
  onRecordingComplete: (segments: { blob: Blob; blobUrl: string }[]) => void;
  onCancel: () => void;
}

export function CameraRecorder({ onRecordingComplete, onCancel }: CameraRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHoldingRecord, setIsHoldingRecord] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const { setIsRecording } = useAppContext();

  const {
    isInitialized,
    isRecording,
    progress,
    currentDuration,
    segments,
    cameraStream,
    initialize,
    switchCamera,
    startSegment,
    stopSegment,
    reset,
    canRecord,
    remainingDuration,
  } = useMediaRecorder();

  // Set recording state on mount/unmount to hide BottomNav
  useEffect(() => {
    setIsRecording(true);
    return () => {
      setIsRecording(false);
    };
  }, [setIsRecording]);

  // Detect desktop
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Initialize camera on mount
  useEffect(() => {
    initialize().catch(error => {
      setCameraError(error.message || 'Failed to access camera');
    });
  }, [initialize]);

  // Attach camera stream to video element
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // Handle press-to-record interaction
  const handleRecordStart = () => {
    if (!canRecord) return;
    setIsHoldingRecord(true);
    startSegment();
  };

  const handleRecordStop = () => {
    setIsHoldingRecord(false);
    stopSegment();
  };

  // Finish recording and return segments
  const handleFinish = () => {
    if (segments.length === 0) {
      onCancel();
      return;
    }

    onRecordingComplete(segments.map(seg => ({
      blob: seg.blob,
      blobUrl: seg.blobUrl,
    })));
  };

  // Format duration for display
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${seconds}.${tenths}s`;
  };

  // Error state
  if (cameraError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="text-center p-8">
          <Camera className="h-16 w-16 mb-4 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold mb-2 text-white">Camera Access Required</h2>
          <p className="text-center text-white/80 mb-4">{cameraError}</p>
          <Button onClick={onCancel} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (!isInitialized) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="text-white text-center">
          <Camera className="h-12 w-12 mb-2 animate-pulse mx-auto" />
          <p>Initializing camera...</p>
        </div>
      </div>
    );
  }

  // Main camera interface
  const cameraContent = (
    <div className="relative w-full h-full bg-black flex flex-col">
      {/* Video preview container - takes available space */}
      <div className="relative flex-1 min-h-0">
        {/* Video element with proper aspect ratio preservation */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-contain"
        />

        {/* Progress bar - fixed at top */}
        <div
          className="absolute left-0 right-0 h-1 bg-white/20 z-20"
          style={{ top: 'var(--sat)' }}
        >
          <div
            className="h-full bg-red-500 transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Duration display - top left with safe area */}
        <div
          className="absolute left-4 bg-black/60 px-3 py-1.5 rounded-full z-10"
          style={{ top: `calc(1rem + var(--sat))` }}
        >
          <span className="text-white text-sm font-medium tabular-nums">
            {formatDuration(currentDuration)} / 6.0s
          </span>
        </div>

        {/* Close button - top right with safe area */}
        <Button
          onClick={onCancel}
          variant="ghost"
          size="icon"
          className="absolute right-4 text-white hover:bg-white/20 z-10"
          style={{ top: `calc(1rem + var(--sat))` }}
        >
          <X className="h-6 w-6" />
        </Button>

        {/* Recording indicator */}
        {isRecording && (
          <div
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-500 px-4 py-2 rounded-full shadow-lg z-10"
            style={{ top: `calc(1rem + var(--sat))` }}
          >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-white text-sm font-medium">REC</span>
          </div>
        )}

        {/* Segment indicators - bottom left */}
        {segments.length > 0 && (
          <div
            className="absolute left-4 flex flex-col gap-1.5 z-10"
            style={{ bottom: 'calc(6.5rem + var(--sab))' }}
          >
            {segments.map((segment, index) => (
              <Badge
                key={index}
                className="bg-black/80 text-white text-xs border-white/20"
              >
                Clip {index + 1}: {formatDuration(segment.duration)}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Controls - fixed at bottom with safe area */}
      <div
        className="flex-shrink-0 bg-black/90 backdrop-blur-sm"
        style={{ paddingBottom: `calc(1.5rem + var(--sab))` }}
      >
        <div className="px-6 pt-6">
          <div className="flex items-center justify-center gap-6 mb-4">
            {/* Switch camera button */}
            <Button
              onClick={switchCamera}
              variant="ghost"
              size="icon"
              className={cn(
                "text-white hover:bg-white/20",
                "w-12 h-12 md:w-10 md:h-10"
              )}
              disabled={isRecording}
            >
              <Repeat className="h-6 w-6 md:h-5 md:w-5" />
            </Button>

            {/* Record button (press and hold) */}
            <button
              onMouseDown={handleRecordStart}
              onMouseUp={handleRecordStop}
              onMouseLeave={handleRecordStop}
              onTouchStart={(e) => {
                e.preventDefault();
                handleRecordStart();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleRecordStop();
              }}
              disabled={!canRecord}
              className={cn(
                "rounded-full border-4 border-white transition-all relative",
                "flex items-center justify-center",
                "active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed",
                "w-20 h-20 md:w-16 md:h-16",
                isHoldingRecord ? "bg-red-500 scale-110 ring-4 ring-red-500/50" : "bg-white/20"
              )}
              aria-label={isRecording ? "Release to pause" : "Hold to record"}
            >
              {/* Ripple effect when recording */}
              {isHoldingRecord && (
                <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
              )}
              <div className={cn(
                "rounded-full transition-all relative z-10",
                "w-12 h-12 md:w-10 md:h-10",
                isHoldingRecord ? "bg-red-600" : "bg-red-500"
              )} />
            </button>

            {/* Finish button */}
            <Button
              onClick={handleFinish}
              variant="ghost"
              size="icon"
              className={cn(
                "text-white hover:bg-white/20",
                "w-12 h-12 md:w-10 md:h-10"
              )}
              disabled={segments.length === 0}
            >
              <span className="text-2xl">✓</span>
            </Button>
          </div>

          {/* Instructions */}
          <div className="text-center space-y-1">
            <p className="text-white/90 text-sm font-medium">
              {canRecord ? (
                <>Hold button to record, release to pause</>
              ) : (
                <>6 second maximum reached</>
              )}
            </p>
            {segments.length > 0 && canRecord && (
              <p className="text-white/60 text-xs">
                {segments.length} clip{segments.length !== 1 ? 's' : ''} • {formatDuration(remainingDuration)} left
              </p>
            )}
          </div>

          {/* Reset button */}
          {segments.length > 0 && (
            <Button
              onClick={reset}
              variant="outline"
              size="sm"
              className="w-full mt-3 border-white/20 text-white hover:bg-white/10"
              disabled={isRecording}
            >
              Start Over
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  // Desktop: wrap in centered modal
  if (isDesktop) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="relative w-full max-w-md h-[90vh] rounded-2xl overflow-hidden shadow-2xl bg-black">
          {cameraContent}
        </div>
      </div>
    );
  }

  // Mobile: full screen
  return (
    <div className="fixed inset-0 z-50">
      {cameraContent}
    </div>
  );
}
