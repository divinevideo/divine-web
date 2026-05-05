// ABOUTME: Hook for fetching trending people lists and video lists for the Discovery page
// ABOUTME: Queries kind 30000 (people lists) and kind 30005 (video lists), ranks by member/video count

import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { parsePeopleList, PEOPLE_LIST_KIND, type PeopleList } from '@/types/peopleList';
import { parseVideoList, type VideoList } from '@/hooks/useVideoLists';

export type DiscoveryListItem =
  | { kind: 30000; list: PeopleList }
  | { kind: 30005; list: VideoList };

const LAST_WEEK_SECONDS = 7 * 24 * 60 * 60;
const TOP_LIMIT = 20;

function scoreList(memberOrVideoCount: number, createdAt: number): number {
  return memberOrVideoCount * 10 + createdAt / 1000;
}

export function useDiscoveryLists() {
  const { nostr } = useNostr();

  return useQuery<DiscoveryListItem[]>({
    queryKey: ['discovery-lists'],
    queryFn: async ({ signal }) => {
      const since = Math.floor(Date.now() / 1000) - LAST_WEEK_SECONDS;
      const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(5000)]);

      const events = await nostr.query(
        [{ kinds: [30000, 30005], since, limit: 50 }],
        { signal: abortSignal },
      );

      const items: DiscoveryListItem[] = [];

      for (const event of events) {
        if (event.kind === PEOPLE_LIST_KIND) {
          const list = parsePeopleList(event);
          if (list !== null) {
            items.push({ kind: 30000, list });
          }
        } else if (event.kind === 30005) {
          const list = parseVideoList(event);
          if (list !== null) {
            items.push({ kind: 30005, list });
          }
        }
      }

      return items
        .sort((a, b) => {
          const countA = a.kind === 30000 ? a.list.members.length : a.list.videoCoordinates.length;
          const countB = b.kind === 30000 ? b.list.members.length : b.list.videoCoordinates.length;
          return scoreList(countB, b.list.createdAt) - scoreList(countA, a.list.createdAt);
        })
        .slice(0, TOP_LIMIT);
    },
    staleTime: 300_000, // 5 minutes
    gcTime: 600_000, // 10 minutes
  });
}
