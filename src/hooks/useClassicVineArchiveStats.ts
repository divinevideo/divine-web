import { useQuery } from '@tanstack/react-query';
import { API_CONFIG } from '@/config/api';
import { fetchUserVideos } from '@/lib/funnelcakeClient';
import { transformFunnelcakeVideo } from '@/lib/funnelcakeTransform';

export interface ClassicVineArchiveStats {
  classicVineCount: number;
  originalLoopCount: number;
}

export function useClassicVineArchiveStats(pubkey: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['classic-vine-archive-stats', pubkey],
    enabled: enabled && !!pubkey,
    queryFn: async ({ signal }): Promise<ClassicVineArchiveStats> => {
      let offset = 0;
      let classicVineCount = 0;
      let originalLoopCount = 0;
      const seenVideos = new Set<string>();

      while (true) {
        const response = await fetchUserVideos(API_CONFIG.funnelcake.baseUrl, pubkey, {
          limit: 100,
          offset,
          signal,
        });

        for (const rawVideo of response.videos) {
          const video = transformFunnelcakeVideo(rawVideo);
          if (!video.isVineMigrated) {
            continue;
          }

          const videoKey = `${video.pubkey}:${video.kind}:${video.vineId || video.id}`;
          if (seenVideos.has(videoKey)) {
            continue;
          }

          seenVideos.add(videoKey);

          classicVineCount += 1;
          originalLoopCount += video.loopCount ?? 0;
        }

        if (!response.has_more || !response.next_cursor) {
          break;
        }

        const nextOffset = Number.parseInt(response.next_cursor, 10);
        if (!Number.isFinite(nextOffset)) {
          break;
        }

        offset = nextOffset;
      }

      return {
        classicVineCount,
        originalLoopCount,
      };
    },
  });
}
