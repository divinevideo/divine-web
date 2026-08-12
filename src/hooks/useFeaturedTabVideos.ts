import { useInfiniteQuery } from '@tanstack/react-query';
import { getFunnelcakeBaseUrl } from '@/config/api';
import { fetchFeaturedTabVideos } from '@/lib/featuredTabsClient';
import { transformToVideoPage } from '@/lib/funnelcakeTransform';
import type { ParsedVideoData } from '@/types/video';

export interface FeaturedTabVideoPage {
  videos: ParsedVideoData[];
  nextCursor: number | undefined;
  rawCursor?: string;
  hasMore: boolean;
}

export function useFeaturedTabVideos({
  configId,
  apiUrl = getFunnelcakeBaseUrl(),
  pageSize = 12,
  enabled = true,
}: {
  configId?: string;
  apiUrl?: string;
  pageSize?: number;
  enabled?: boolean;
}) {
  return useInfiniteQuery<FeaturedTabVideoPage, Error>({
    queryKey: ['featured-tab-videos', apiUrl, configId, pageSize],
    queryFn: async ({ pageParam, signal }) => {
      if (!configId) {
        throw new Error('Featured tab config id is required');
      }

      const response = await fetchFeaturedTabVideos(
        apiUrl,
        configId,
        typeof pageParam === 'string' ? pageParam : undefined,
        pageSize,
        signal
      );

      return transformToVideoPage(response, 'cursor');
    },
    getNextPageParam: (lastPage) => lastPage.rawCursor,
    initialPageParam: undefined,
    enabled: enabled && !!configId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    meta: {
      source: 'funnelcake',
      apiUrl,
    },
  });
}
