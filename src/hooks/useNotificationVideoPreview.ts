import { useQuery } from '@tanstack/react-query';

import { API_CONFIG } from '@/config/api';
import { fetchVideoById } from '@/lib/funnelcakeClient';
import { sanitizeImageUrl } from '@/lib/imageUtils';
import { extractSha256FromVideoUrl, fetchVideoModerationStatus, normalizeSha256 } from '@/lib/videoVerification';
import type { FunnelcakeVideoRaw } from '@/types/funnelcake';

export function useNotificationVideoPreview(videoId: string, enabled: boolean, knownVideoUrl?: string) {
  const apiUrl = API_CONFIG.funnelcake.baseUrl;
  return useQuery({
    queryKey: ['notification-video-preview', apiUrl, videoId, knownVideoUrl],
    queryFn: async ({ signal }) => {
      const knownHash = extractSha256FromVideoUrl(knownVideoUrl);
      const video: Partial<FunnelcakeVideoRaw> | null = knownVideoUrl && knownHash
        ? { video_url: knownVideoUrl, sha256: knownHash }
        : await fetchVideoById(apiUrl, videoId, undefined, signal);
      if (!video) return null;
      const imetaHash = video.tags?.find((tag) => tag[0] === 'imeta')
        ?.slice(1).find((value) => value.startsWith('x '))?.slice(2);
      const hash = normalizeSha256(video.sha256) ?? normalizeSha256(imetaHash)
        ?? extractSha256FromVideoUrl(video.video_url);
      if (!hash) return null;
      const status = await fetchVideoModerationStatus(hash, signal);
      if (!status || status.blocked || status.quarantined) return null;
      return {
        videoUrl: sanitizeImageUrl(video.video_url),
        ageRestricted: status.ageRestricted,
      };
    },
    enabled: enabled && Boolean(videoId),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
