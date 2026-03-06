import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { API_CONFIG } from '@/config/api';
import { SHORT_VIDEO_KIND, type ParsedVideoData } from '@/types/video';
import type { FunnelcakeVideoRaw } from '@/types/funnelcake';
import { fetchUserVideos, fetchVideoById } from '@/lib/funnelcakeClient';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { debugLog } from '@/lib/debug';
import { getOriginalVineTimestamp, isVineMigrated } from '@/lib/videoParser';

interface UseProfileJoinedDateOptions {
  videos?: ParsedVideoData[];
  totalVideoCount?: number;
  allVideosLoaded?: boolean;
  enabled?: boolean;
}

function getLoadedVideoTimestamps(videos: ParsedVideoData[]) {
  const exactVineTimestamps = videos
    .filter(video => video.isVineMigrated && typeof video.originalVineTimestamp === 'number')
    .map(video => video.originalVineTimestamp as number);

  const earliestLoadedVideoTimestamp = videos.length > 0
    ? Math.min(...videos.map(video => video.createdAt))
    : null;

  return {
    earliestExactVineTimestamp: exactVineTimestamps.length > 0 ? Math.min(...exactVineTimestamps) : null,
    earliestLoadedVideoTimestamp,
  };
}

function getOriginalVineTimestampFromRawVideo(video: FunnelcakeVideoRaw | null): number | null {
  if (!video?.tags) return null;

  const event = {
    id: typeof video.id === 'string' ? video.id : '',
    pubkey: typeof video.pubkey === 'string' ? video.pubkey : '',
    created_at: video.created_at,
    kind: video.kind,
    tags: video.tags,
    content: video.content || '',
    sig: '',
  } as NostrEvent;

  return getOriginalVineTimestamp(event) ?? null;
}

function getEarliestTimestampFromEvents(events: NostrEvent[]): number | null {
  const timestamps = events
    .map(event => {
      if (event.kind === SHORT_VIDEO_KIND && isVineMigrated(event)) {
        return getOriginalVineTimestamp(event) ?? event.created_at;
      }
      return event.created_at;
    })
    .filter((timestamp): timestamp is number => typeof timestamp === 'number' && !Number.isNaN(timestamp));

  return timestamps.length > 0 ? Math.min(...timestamps) : null;
}

export function useProfileJoinedDate(
  pubkey: string,
  {
    videos = [],
    totalVideoCount = 0,
    allVideosLoaded = false,
    enabled = true,
  }: UseProfileJoinedDateOptions = {},
) {
  const { nostr } = useNostr();
  const apiUrl = API_CONFIG.funnelcake.baseUrl;

  const {
    earliestExactVineTimestamp,
    earliestLoadedVideoTimestamp,
  } = useMemo(() => getLoadedVideoTimestamps(videos), [videos]);

  return useQuery({
    queryKey: [
      'profile-joined-date',
      pubkey,
      totalVideoCount,
      allVideosLoaded,
      earliestExactVineTimestamp,
      earliestLoadedVideoTimestamp,
    ],
    enabled: enabled && !!pubkey,
    staleTime: 300000,
    gcTime: 1800000,
    retry: 1,
    queryFn: async ({ signal }) => {
      if (!pubkey) return null;

      if (earliestExactVineTimestamp) {
        return new Date(earliestExactVineTimestamp * 1000);
      }

      if (allVideosLoaded && earliestLoadedVideoTimestamp) {
        return new Date(earliestLoadedVideoTimestamp * 1000);
      }

      if (totalVideoCount > 0 && isFunnelcakeAvailable(apiUrl)) {
        try {
          const oldestVideoOffset = Math.max(totalVideoCount - 1, 0);
          const response = await fetchUserVideos(apiUrl, pubkey, {
            limit: 1,
            offset: oldestVideoOffset,
            sort: 'recent',
            signal,
          });

          const oldestVideo = response.videos[0];
          if (oldestVideo) {
            let joinedTimestamp = oldestVideo.created_at;

            if (oldestVideo.platform === 'vine' || oldestVideo.classic === true) {
              const fullVideo = await fetchVideoById(apiUrl, oldestVideo.id, pubkey, signal);
              const originalVineTimestamp = getOriginalVineTimestampFromRawVideo(fullVideo);
              if (originalVineTimestamp) {
                joinedTimestamp = originalVineTimestamp;
              }
            }

            return new Date(joinedTimestamp * 1000);
          }
        } catch (error) {
          debugLog('[useProfileJoinedDate] Failed to fetch oldest profile video', error);
        }
      }

      try {
        const joinedDateSignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
        const events = await nostr.query([{
          authors: [pubkey],
          kinds: [SHORT_VIDEO_KIND, 0, 3],
          limit: 200,
        }], { signal: joinedDateSignal });

        const earliestEventTimestamp = getEarliestTimestampFromEvents(events);
        if (earliestEventTimestamp) {
          return new Date(earliestEventTimestamp * 1000);
        }
      } catch (error) {
        debugLog('[useProfileJoinedDate] Failed to query Nostr fallback events', error);
      }

      if (earliestLoadedVideoTimestamp) {
        return new Date(earliestLoadedVideoTimestamp * 1000);
      }

      return null;
    },
  });
}
