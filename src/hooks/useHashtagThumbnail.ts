// ABOUTME: Hook to fetch thumbnail for a hashtag using Funnelcake API
// ABOUTME: Returns the thumbnail URL of the top video for a given hashtag

import { useQuery } from '@tanstack/react-query';
import { searchVideos } from '@/lib/funnelcakeClient';
import { DEFAULT_FUNNELCAKE_URL } from '@/config/relays';

/**
 * Hook to fetch thumbnail for a hashtag
 * Uses Funnelcake API to get the top video for the hashtag
 */
export function useHashtagThumbnail(hashtag: string) {
  return useQuery({
    queryKey: ['hashtag-thumbnail', hashtag],
    queryFn: async (context) => {
      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(8000),
      ]);

      // Fetch top video for this hashtag from Funnelcake
      const response = await searchVideos(DEFAULT_FUNNELCAKE_URL, {
        tag: hashtag,
        limit: 1,
        sort: 'trending',
        signal,
      });

      // Return the thumbnail URL if we have a video
      if (response.videos.length > 0) {
        const video = response.videos[0];
        return video.thumbnail || video.video_url;
      }

      return undefined;
    },
    staleTime: 300000, // 5 minutes
    gcTime: 900000,    // 15 minutes
  });
}
