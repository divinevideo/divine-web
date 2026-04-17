// ABOUTME: Hook for combining video segments and uploading to Blossom servers
// ABOUTME: Handles multi-segment video compilation and upload progress tracking

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useToast } from '@/hooks/useToast';

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

  // Combine video segments into a single video
  const combineSegments = useCallback(async (segments: VideoSegment[]): Promise<CombineResult> => {
    if (segments.length === 0) {
      throw new Error('No segments to combine');
    }

    // If only one segment, return it directly
    if (segments.length === 1) {
      const blob = segments[0].blob;
      const blobUrl = segments[0].blobUrl;
      
      // Get duration from blob using video element
      const duration = await getVideoDuration(blob);
      
      return {
        blob,
        blobUrl,
        duration,
      };
    }

    // For multiple segments, we need to combine them
    // For now, we'll use a simple approach: create a new video from all blobs
    // In production, you'd want to use FFmpeg.wasm for proper video concatenation
    
    try {
      // Check if FFmpeg.wasm is available (optional enhancement)
      // For MVP, we'll just use the first segment and warn the user
      toast({
        title: 'Multi-clip recording.',
        description: 'Using the first clip for now — full merging is coming soon.',
        variant: 'default',
      });

      const blob = segments[0].blob;
      const blobUrl = segments[0].blobUrl;
      const duration = await getVideoDuration(blob);

      return {
        blob,
        blobUrl,
        duration,
      };
    } catch (error) {
      console.error('Failed to combine segments:', error);
      throw new Error('Failed to combine video segments');
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
      // Step 1: Combine segments (25% of progress)
      setUploadProgress(0.1);
      const combined = await combineSegments(params.segments);
      setUploadProgress(0.25);

      // Step 2: Upload video (75% of progress)
      const result = await uploadVideoMutation.mutateAsync({
        blob: combined.blob,
        filename: params.filename,
      });
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
