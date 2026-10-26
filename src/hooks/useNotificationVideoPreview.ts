import { useQuery } from '@tanstack/react-query';

import { API_CONFIG } from '@/config/api';
import { fetchVideoById } from '@/lib/funnelcakeClient';
import { sanitizeImageUrl } from '@/lib/imageUtils';

export function useNotificationVideoPreview(videoId: string, enabled: boolean) {
  const apiUrl = API_CONFIG.funnelcake.baseUrl;
  return useQuery({
    queryKey: ['notification-video-preview', apiUrl, videoId],
    queryFn: async ({ signal }) => {
      const video = await fetchVideoById(apiUrl, videoId, undefined, signal);
      if (!video) return null;
      return {
        videoUrl: sanitizeImageUrl(video.video_url),
        ageRestricted: video.age_restricted === true || video.moderation_status === 'age_restricted',
      };
    },
    enabled: enabled && Boolean(videoId),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
