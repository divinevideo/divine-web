// ABOUTME: Hook for combining video segments and uploading to Blossom servers
// ABOUTME: Handles multi-segment video compilation, MP4 conversion, and upload progress tracking

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useToast } from '@/hooks/useToast';
import { combineAndConvertToMP4, convertToMP4 } from '@/lib/videoConverter';

interface VideoSegment {
  blob: Blob;
  blobUrl: string;
}

interface CombineResult {
  blob: Blob;
  blobUrl: string;
  duration: number;
}

export function useVideoUpload() {
  const { toast } = useToast();
  const { mutateAsync: uploadFile } = useUploadFile();
  const [uploadProgress, setUploadProgress] = useState(0);

  // Combine video segments and convert to MP4
  const combineSegments = useCallback(async (
    segments: VideoSegment[],
    onConversionProgress?: (progress: number) => void
  ): Promise<CombineResult> => {
    if (segments.length === 0) {
      throw new Error('No segments to combine');
    }

    console.log('[useVideoUpload] Starting video conversion to MP4...', {
      segmentCount: segments.length,
      totalSize: `${(segments.reduce((sum, s) => sum + s.blob.size, 0) / 1024 / 1024).toFixed(2)}MB`,
    });

    try {
      // Extract blobs from segments
      const blobs = segments.map(s => s.blob);

      // Convert to MP4 using FFmpeg.wasm
      // This will either combine multiple segments or convert a single segment
      console.log('[useVideoUpload] Calling combineAndConvertToMP4...');
      const result = await combineAndConvertToMP4(blobs, onConversionProgress);
      console.log('[useVideoUpload] Conversion complete, getting duration...');

      // Get duration from converted blob
      const duration = await getVideoDuration(result.blob);

      console.log('[useVideoUpload] Video ready!', {
        duration: `${(duration / 1000).toFixed(1)}s`,
        mp4Size: `${(result.blob.size / 1024 / 1024).toFixed(2)}MB`,
      });

      toast({
        title: 'Video Converted to MP4',
        description: `Optimized for maximum compatibility (${result.sizeReduction > 0 ? `${result.sizeReduction.toFixed(1)}% smaller` : 'same size'})`,
      });

      return {
        blob: result.blob,
        blobUrl: result.blobUrl,
        duration,
      };
    } catch (error) {
      console.error('[useVideoUpload] Conversion failed, using original video:', error);

      // Fallback: Use original video without conversion
      toast({
        title: 'Video Conversion Skipped',
        description: 'Using original video format. Conversion failed but upload will continue.',
        variant: 'default',
      });

      // If single segment, use it directly
      if (segments.length === 1) {
        const blob = segments[0].blob;
        const duration = await getVideoDuration(blob);

        console.log('[useVideoUpload] Using original single segment:', {
          type: blob.type,
          size: `${(blob.size / 1024 / 1024).toFixed(2)}MB`,
          duration: `${(duration / 1000).toFixed(1)}s`,
        });

        return {
          blob,
          blobUrl: segments[0].blobUrl,
          duration,
        };
      } else {
        // Multiple segments without conversion - just use first one
        console.warn('[useVideoUpload] Multiple segments but conversion failed, using first segment only');
        const blob = segments[0].blob;
        const duration = await getVideoDuration(blob);

        return {
          blob,
          blobUrl: segments[0].blobUrl,
          duration,
        };
      }
    }
  }, [toast]);

  // Get video duration from blob
  const getVideoDuration = useCallback((blob: Blob): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration * 1000); // Convert to milliseconds
      };

      video.onerror = () => {
        window.URL.revokeObjectURL(video.src);
        reject(new Error('Failed to load video metadata'));
      };

      video.src = URL.createObjectURL(blob);
    });
  }, []);

  // Convert blob to File object for upload
  const blobToFile = useCallback((blob: Blob, filename: string): File => {
    return new File([blob], filename, { type: blob.type });
  }, []);

  // Upload combined video
  const uploadVideoMutation = useMutation({
    mutationFn: async (params: { blob: Blob; filename?: string }) => {
      const { blob, filename = `vine-${Date.now()}.webm` } = params;
      const file = blobToFile(blob, filename);

      // Upload to Blossom
      const tags = await uploadFile(file);

      // Extract URL from tags
      // Tags format: [['url', 'https://...'], ['m', 'video/webm'], ...]
      const urlTag = tags.find((tag: string[]) => tag[0] === 'url');
      if (!urlTag || !urlTag[1]) {
        throw new Error('Upload succeeded but no URL returned');
      }

      return {
        url: urlTag[1],
        tags,
      };
    },
    onError: (error) => {
      console.error('Upload failed:', error);
      toast({
        title: 'Upload snagged.',
        description: error instanceof Error ? error.message : 'Couldn\'t send your loop. Try again?',
        variant: 'destructive',
      });
    },
  });

  // Upload video with progress tracking
  const uploadVideo = useCallback(async (params: {
    segments: VideoSegment[];
    filename?: string;
  }): Promise<{ url: string; tags: string[][]; duration: number }> => {
    setUploadProgress(0);

    try {
      console.log('[useVideoUpload] uploadVideo called with:', {
        segmentCount: params.segments.length,
        filename: params.filename,
      });

      // Step 1: Combine and convert to MP4 (50% of progress)
      setUploadProgress(0.05);
      console.log('[useVideoUpload] Starting segment combination...');

      const combined = await combineSegments(params.segments, (conversionProgress) => {
        // Map conversion progress to 5-50% of total progress
        const newProgress = 0.05 + (conversionProgress * 0.45);
        console.log('[useVideoUpload] Conversion progress update:', {
          conversionProgress,
          totalProgress: newProgress,
          percentage: `${Math.round(newProgress * 100)}%`,
        });
        setUploadProgress(newProgress);
      });

      console.log('[useVideoUpload] Segments combined successfully');
      setUploadProgress(0.5);

      // Step 2: Upload video (50% of progress)
      console.log('[useVideoUpload] Starting upload to Blossom...');

      // Determine filename based on blob type
      let filename = params.filename;
      if (!filename) {
        const extension = combined.blob.type.includes('mp4') ? 'mp4' :
                         combined.blob.type.includes('webm') ? 'webm' : 'mp4';
        filename = `video-${Date.now()}.${extension}`;
      }

      console.log('[useVideoUpload] Uploading as:', filename);

      const result = await uploadVideoMutation.mutateAsync({
        blob: combined.blob,
        filename,
      });

      console.log('[useVideoUpload] Upload successful!', result.url);
      setUploadProgress(1);

      // Clean up blob URLs
      params.segments.forEach(segment => {
        URL.revokeObjectURL(segment.blobUrl);
      });
      if (combined.blobUrl !== params.segments[0].blobUrl) {
        URL.revokeObjectURL(combined.blobUrl);
      }

      return {
        ...result,
        duration: combined.duration,
      };
    } catch (error) {
      console.error('[useVideoUpload] uploadVideo failed:', error);
      console.error('[useVideoUpload] Error details:', {
        errorType: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      setUploadProgress(0);
      throw error;
    }
  }, [combineSegments, uploadVideoMutation]);

  return {
    uploadVideo,
    uploadProgress,
    isUploading: uploadVideoMutation.isPending,
  };
}
