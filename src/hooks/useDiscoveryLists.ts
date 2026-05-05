// ABOUTME: Hook for fetching trending people lists and video lists for the Discovery page
// ABOUTME: Queries kind 30000 (people lists) and kind 30005 (video lists), ranks by member/video count

import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { parsePeopleList, PEOPLE_LIST_KIND, type PeopleList } from '@/types/peopleList';
import { parseVideoList, type VideoList } from '@/hooks/useVideoLists';

export type DiscoveryListItem =
  | { kind: 30000; list: PeopleList }
  | { kind: 30005; list: VideoList };

const TOP_LIMIT = 20;
const RELAY_FETCH_LIMIT = 500;

function scoreList(memberOrVideoCount: number, createdAt: number): number {
  return memberOrVideoCount * 10 + createdAt / 1000;
}

export function useDiscoveryLists() {
  const { nostr } = useNostr();

  return useQuery<DiscoveryListItem[]>({
    queryKey: ['discovery-lists'],
    queryFn: async ({ signal }) => {
      // Addressable events (kinds 30000/30005) republish only when edited, so
      // a `since` filter excludes most real curated lists. Pull a wide pool
      // and rank locally instead.
      const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(8000)]);

      const events = await nostr.query(
        [{ kinds: [30000, 30005], limit: RELAY_FETCH_LIMIT }],
        { signal: abortSignal },
      );

      // Dedupe addressable events by `pubkey:kind:dTag` keeping the newest.
      const latestByCoord = new Map<string, typeof events[number]>();
      for (const event of events) {
        const dTag = event.tags.find(t => t[0] === 'd')?.[1];
        if (!dTag) continue;
        const coord = `${event.kind}:${event.pubkey}:${dTag}`;
        const existing = latestByCoord.get(coord);
        if (!existing || event.created_at > existing.created_at) {
          latestByCoord.set(coord, event);
        }
      }

      const items: DiscoveryListItem[] = [];

      for (const event of latestByCoord.values()) {
        if (event.kind === PEOPLE_LIST_KIND) {
          // Discovery surfaces require a real name — skip events whose name
          // would fall back to the d-tag, which is how non-curated system
          // lists from other clients leak in.
          const hasTitle = !!event.tags.find(t => t[0] === 'title')?.[1];
          if (!hasTitle) continue;
          const list = parsePeopleList(event);
          // Empty lists are noise in discovery — nothing to thumbnail, nothing to show.
          if (list !== null && list.members.length > 0) {
            items.push({ kind: 30000, list });
          }
        } else if (event.kind === 30005) {
          const list = parseVideoList(event);
          if (list !== null && list.videoCoordinates.length > 0) {
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
