// ABOUTME: Hook to fetch a single video by ID via Funnelcake REST API
// ABOUTME: Provides fast video lookup for VideoPage with profile and hashtag context support

import { useQuery } from '@tanstack/react-query';
import { getFunnelcakeBaseUrl } from '@/config/api';
import { fetchVideoById, fetchUserVideos, searchVideos } from '@/lib/funnelcakeClient';
import { transformFunnelcakeVideo } from '@/lib/funnelcakeTransform';
import { getFunnelcakeUrl } from '@/config/relays';
import { useAppContext } from '@/hooks/useAppContext';
import { debugLog } from '@/lib/debug';
import type { ParsedVideoData } from '@/types/video';

interface UseVideoByIdOptions {
  videoId: string;
  pubkey?: string;   // Optional pubkey for profile context
  hashtag?: string;  // Optional hashtag for hashtag feed context
  currentIndex?: number; // Optional global index from feed context for neighbor windowing
  enabled?: boolean;
}

interface UseVideoByIdResult {
  video: ParsedVideoData | null;
  videos: ParsedVideoData[] | null;  // Neighboring videos for navigation
  windowOffset: number;
  isLoading: boolean;
  error: Error | null;
}

const NAVIGATION_WINDOW_SIZE = 16;

function getNavigationWindowOffset(currentIndex?: number): number {
  if (currentIndex === undefined || currentIndex < 0) {
    return 0;
  }
  return Math.max(0, currentIndex - Math.floor(NAVIGATION_WINDOW_SIZE / 2));
}

/**
 * Hook to fetch a single video by ID via Funnelcake REST API
 *
 * If pubkey is provided, fetches all videos from that user for navigation context.
 * If hashtag is provided, fetches videos from that hashtag for navigation context.
 * The single video lookup is faster than WebSocket queries.
 */
export function useVideoByIdFunnelcake(options: UseVideoByIdOptions): UseVideoByIdResult {
  const { videoId, pubkey, hashtag, currentIndex, enabled = true } = options;
  const { config } = useAppContext();
  const windowOffset = getNavigationWindowOffset(currentIndex);

  // Determine API URL from current relay
  const funnelcakeUrl = getFunnelcakeUrl(config.relayUrl) || getFunnelcakeBaseUrl();

  // If we have a pubkey, fetch all their videos for navigation context
  const userVideosQuery = useQuery({
    queryKey: ['funnelcake-user-videos', pubkey, funnelcakeUrl, windowOffset],
    queryFn: async ({ signal }) => {
      if (!pubkey) return null;

      debugLog(`[useVideoByIdFunnelcake] Fetching user videos for ${pubkey}`);
      const response = await fetchUserVideos(funnelcakeUrl, pubkey, {
        limit: NAVIGATION_WINDOW_SIZE,
        offset: windowOffset,
        sort: 'recent',
        signal,
      });

      return response.videos.map(transformFunnelcakeVideo);
    },
    enabled: enabled && !!pubkey,
    staleTime: 300000, // 5 minutes
    gcTime: 900000,    // 15 minutes
  });

  // If we have a hashtag, fetch videos from that hashtag for navigation context
  const hashtagVideosQuery = useQuery({
    queryKey: ['funnelcake-hashtag-videos', hashtag, funnelcakeUrl, windowOffset],
    queryFn: async ({ signal }) => {
      if (!hashtag) return null;

      debugLog(`[useVideoByIdFunnelcake] Fetching hashtag videos for #${hashtag}`);
      const response = await searchVideos(funnelcakeUrl, {
        tag: hashtag,
        limit: NAVIGATION_WINDOW_SIZE,
        offset: windowOffset,
        signal,
      });

      return response.videos.map(transformFunnelcakeVideo);
    },
    enabled: enabled && !!hashtag && !pubkey, // Only fetch if hashtag context and no pubkey
    staleTime: 300000, // 5 minutes
    gcTime: 900000,    // 15 minutes
  });

  const contextVideos = userVideosQuery.data ?? hashtagVideosQuery.data ?? null;
  const contextVideo = contextVideos?.find(v => v.id === videoId || v.vineId === videoId) || null;
  const contextLoading = pubkey
    ? userVideosQuery.isLoading
    : hashtag
      ? hashtagVideosQuery.isLoading
      : false;
  const contextError = pubkey
    ? (userVideosQuery.error as Error | null)
    : hashtag
      ? (hashtagVideosQuery.error as Error | null)
      : null;
  const shouldLookupSingleVideo = enabled && (
    (!pubkey && !hashtag)
      || (((!!pubkey || !!hashtag) && !contextLoading && !contextVideo))
  );

  // Single video lookup (used when no context or as fallback)
  const singleVideoQuery = useQuery({
    queryKey: ['funnelcake-video', videoId, funnelcakeUrl],
    queryFn: async ({ signal }) => {
      debugLog(`[useVideoByIdFunnelcake] Fetching single video ${videoId}`);
      const video = await fetchVideoById(funnelcakeUrl, videoId, pubkey, signal);

      if (!video) return null;
      return transformFunnelcakeVideo(video);
    },
    // Fall back to a direct lookup when the narrowed context window misses the target.
    enabled: shouldLookupSingleVideo,
    staleTime: 300000,
    gcTime: 900000,
  });

  const video = contextVideo || singleVideoQuery.data || null;
  const videos = contextVideo ? contextVideos : null;
  const isLoading = contextLoading || singleVideoQuery.isLoading;
  const error = video
    ? null
    : ((singleVideoQuery.error as Error | null) || contextError);

  return {
    video,
    videos,
    windowOffset,
    isLoading,
    error,
  };
}
