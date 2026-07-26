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

export function usePeopleListVideos(memberPubkeys: string[]) {
  const { nostr } = useNostr();
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
      // Paginate whenever the raw result could have hit a per-filter limit,
      // even if dedupe/trimming shrank the merged page below the cap. The
      // cursor derives from the oldest raw event so discarded duplicates
      // never make older videos unreachable.
      const nextUntil = events.length >= PEOPLE_LIST_VIDEO_PAGE_SIZE
        ? Math.min(...events.map((event) => event.created_at)) - 1
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
