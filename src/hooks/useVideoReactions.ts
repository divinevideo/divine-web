// ABOUTME: Hook for getting the list of users who liked or reposted a video
// ABOUTME: Reuses cached data from useVideoSocialMetrics to avoid duplicate queries

import { useQueryClient } from '@tanstack/react-query';
import type { VideoReaction, VideoSocialMetrics } from '@/hooks/useVideoSocialMetrics';

export interface VideoReactions {
  likes: VideoReaction[];
  reposts: VideoReaction[];
}

/**
 * Get the list of users who liked or reposted a video
 * Reuses cached data from useVideoSocialMetrics to avoid duplicate queries
 * 
 * @param videoId - The video event ID
 * @param videoPubkey - The video author's pubkey (required for addressable events)
 * @param vineId - The video's vineId (d tag) for addressable events
 * @param options - Optional query options
 */
export function useVideoReactions(
  videoId: string,
  videoPubkey: string,
  vineId: string | null,
  options?: { enabled?: boolean }
) {
  const queryClient = useQueryClient();

  // Get cached data from useVideoSocialMetrics
  const cachedData = queryClient.getQueryData<VideoSocialMetrics>([
    'video-social-metrics',
    videoId,
    videoPubkey,
    vineId,
  ]);

  if (!cachedData || (options?.enabled === false)) {
    return {
      data: { likes: [], reposts: [] } as VideoReactions,
      isLoading: false,
      isError: false,
    };
  }

  return {
    data: {
      likes: cachedData.likes || [],
      reposts: cachedData.reposts || [],
    } as VideoReactions,
    isLoading: false,
    isError: false,
  };
}

