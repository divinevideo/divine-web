// ABOUTME: Hook for managing web camera recording using MediaRecorder API
// ABOUTME: Provides press-to-record, release-to-pause Vine-style recording functionality

import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/useToast';

export interface RecordingSegment {
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
  blobUrl: string;
  blob: Blob;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  isInitialized: boolean;
  progress: number; // 0-1
  currentDuration: number; // milliseconds
  segments: RecordingSegment[];
  cameraStream: MediaStream | null;
}

const MAX_DURATION = 6000; // 6 seconds in milliseconds
const PROGRESS_UPDATE_INTERVAL = 50; // Update progress every 50ms

export function useMediaRecorder() {
  const { toast } = useToast();
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    isInitialized: false,
    progress: 0,
    currentDuration: 0,
    segments: [],
    cameraStream: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const segmentStartTimeRef = useRef<number>(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const totalDurationRef = useRef<number>(0);

  // Get optimal video constraints based on device
  const getOptimalVideoConstraints = useCallback(() => {
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      // Mobile - always use square for consistent recording
      return {
        width: { ideal: 1080 },
        height: { ideal: 1080 },
        aspectRatio: { ideal: 1 },
      };
    } else {
      // Desktop - square for better desktop experience
      return {
        width: { ideal: 1080 },
        height: { ideal: 1080 },
        aspectRatio: { ideal: 1 },
      };
    }
  }, []);

  // Initialize camera
  const initialize = useCallback(async (useFrontCamera = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: useFrontCamera ? 'user' : 'environment',
          ...getOptimalVideoConstraints(),
        },
        audio: true,
      });

      streamRef.current = stream;
      setState(prev => ({
        ...prev,
        isInitialized: true,
        cameraStream: stream,
      }));

      return stream;
    } catch (error) {
      console.error('Failed to access camera:', error);
      toast({
        title: 'Camera\'s locked out.',
        description: 'Let us into the camera and mic to record.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [toast, getOptimalVideoConstraints]);

  // Switch camera (front/back)
  const switchCamera = useCallback(async () => {
    if (!streamRef.current) return;

    const currentFacingMode = streamRef.current.getVideoTracks()[0].getSettings().facingMode;
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

    // Stop current stream
    streamRef.current.getTracks().forEach(track => track.stop());

    // Reinitialize with new camera
    await initialize(newFacingMode === 'user');
  }, [initialize]);

  // Get supported MIME type
  const getSupportedMimeType = useCallback((): string => {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm'; // Fallback
  }, []);

  // Start recording a new segment
  const startSegment = useCallback(() => {
    if (!streamRef.current || state.currentDuration >= MAX_DURATION) {
      return;
    }

    chunksRef.current = [];
    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(streamRef.current, { mimeType });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      const endTime = Date.now();
      const duration = endTime - segmentStartTimeRef.current;

      const segment: RecordingSegment = {
        startTime: new Date(segmentStartTimeRef.current),
        endTime: new Date(endTime),
        duration,
        blobUrl,
        blob,
      };

      totalDurationRef.current += duration;

      setState(prev => ({
        ...prev,
        segments: [...prev.segments, segment],
        currentDuration: totalDurationRef.current,
        progress: Math.min(totalDurationRef.current / MAX_DURATION, 1),
        isRecording: false,
      }));
    };

    mediaRecorderRef.current = recorder;
    segmentStartTimeRef.current = Date.now();

    recorder.start();

    setState(prev => ({
      ...prev,
      isRecording: true,
      isPaused: false,
    }));

    // Start progress tracking
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - segmentStartTimeRef.current;
      const totalElapsed = totalDurationRef.current + elapsed;

      setState(prev => ({
        ...prev,
        currentDuration: totalElapsed,
        progress: Math.min(totalElapsed / MAX_DURATION, 1),
      }));

      // Auto-stop at max duration
      if (totalElapsed >= MAX_DURATION) {
        stopSegment();
      }
    }, PROGRESS_UPDATE_INTERVAL);
  }, [state.currentDuration, getSupportedMimeType]);

  // Stop current recording segment
  const stopSegment = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isRecording: false,
      isPaused: true,
    }));
  }, []);

  // Reset recording (discard all segments)
  const reset = useCallback(() => {
    // Stop any active recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    // Revoke all blob URLs to free memory
    state.segments.forEach(segment => {
      URL.revokeObjectURL(segment.blobUrl);
    });

    totalDurationRef.current = 0;

    setState(prev => ({
      ...prev,
      isRecording: false,
      isPaused: false,
      progress: 0,
      currentDuration: 0,
      segments: [],
    }));
  }, [state.segments]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Revoke all blob URLs
      state.segments.forEach(segment => {
        URL.revokeObjectURL(segment.blobUrl);
      });
    };
  }, [state.segments]);

  return {
    ...state,
    initialize,
    switchCamera,
    startSegment,
    stopSegment,
    reset,
    canRecord: state.currentDuration < MAX_DURATION,
    remainingDuration: Math.max(0, MAX_DURATION - state.currentDuration),
  };
}
