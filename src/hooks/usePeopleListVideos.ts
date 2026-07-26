// ABOUTME: Paginated public video feed assembled from all members of a people list

import { useNostr } from '@nostrify/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { parseVideoEvents } from '@/lib/videoParser';
import {
  buildPeopleListVideoFilters,
  mergePeopleListVideoEvents,
  PEOPLE_LIST_VIDEO_PAGE_SIZE,
} from '@/lib/peopleListVideos';
import type { ParsedVideoData } from '@/types/video';

export interface PeopleListVideoPage {
  videos: ParsedVideoData[];
  nextUntil?: number;
}

export function usePeopleListVideos(memberPubkeys: string[]) {
  const { nostr } = useNostr();
  const stableMembers = Array.from(new Set(memberPubkeys)).sort();

  return useInfiniteQuery({
    queryKey: ['people-list-videos', stableMembers],
    queryFn: async ({ pageParam, signal }): Promise<PeopleListVideoPage> => {
      const until = pageParam as number | undefined;
      const filters = buildPeopleListVideoFilters(stableMembers, until);
      const events = await nostr.query(filters, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
      const mergedEvents = mergePeopleListVideoEvents(events);
      const nextUntil = mergedEvents.length === PEOPLE_LIST_VIDEO_PAGE_SIZE
        ? mergedEvents[mergedEvents.length - 1].created_at - 1
        : undefined;

      return {
        videos: parseVideoEvents(mergedEvents),
        nextUntil,
      };
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextUntil,
    enabled: stableMembers.length > 0,
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
