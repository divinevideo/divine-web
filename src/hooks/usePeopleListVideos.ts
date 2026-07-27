// ABOUTME: Paginated public video feed assembled from all members of a people list

import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { parseVideoEvents } from '@/lib/videoParser';
import {
  buildPeopleListVideoFilters,
  mergePeopleListVideoEvents,
  PEOPLE_LIST_VIDEO_PAGE_SIZE,
} from '@/lib/peopleListVideos';
import { useFeedBlocklist } from '@/hooks/useFeedBlocklist';
import { filterBlockedVideoPages } from '@/lib/blocklistFilter';
import type { ParsedVideoData } from '@/types/video';

export interface PeopleListVideoPage {
  videos: ParsedVideoData[];
  nextUntil?: number;
}

interface UsePeopleListVideosOptions {
  enabled?: boolean;
}

function getNextUntil(events: { created_at: number }[], mergedEvents: { created_at: number }[]): number | undefined {
  if (mergedEvents.length >= PEOPLE_LIST_VIDEO_PAGE_SIZE) {
    return mergedEvents[mergedEvents.length - 1].created_at - 1;
  }

  if (events.length >= PEOPLE_LIST_VIDEO_PAGE_SIZE && events.length > 0) {
    return Math.min(...events.map((event) => event.created_at)) - 1;
  }

  return undefined;
}

export function usePeopleListVideos(memberPubkeys: string[], options: UsePeopleListVideosOptions = {}) {
  const { nostr } = useNostr();
  const { enabled = true } = options;
  const stableMembers = Array.from(new Set(memberPubkeys)).sort();

  const query = useInfiniteQuery({
    queryKey: ['people-list-videos', stableMembers],
    queryFn: async ({ pageParam, signal }): Promise<PeopleListVideoPage> => {
      const until = pageParam as number | undefined;
      const filters = buildPeopleListVideoFilters(stableMembers, until);
      const events = await nostr.query(filters, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
      const mergedEvents = mergePeopleListVideoEvents(events);
      const nextUntil = getNextUntil(events, mergedEvents);

      return {
        videos: parseVideoEvents(mergedEvents),
        nextUntil,
      };
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextUntil,
    enabled: enabled && stableMembers.length > 0,
    staleTime: 60_000,
    gcTime: 300_000,
  });

  // Per-viewer block/mute filtering, matching useVideoProvider (divine-web#399).
  // Deleted videos are excluded relay-side: relays honoring NIP-09 drop them
  // from query results, same as the other WebSocket feeds.
  const blockedPubkeys = useFeedBlocklist();
  const data = useMemo(
    () => filterBlockedVideoPages(query.data, blockedPubkeys),
    [query.data, blockedPubkeys],
  );

  return { ...query, data };
}
