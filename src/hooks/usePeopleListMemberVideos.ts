// ABOUTME: Aggregated video feed from all members of a NIP-51 people list (kind 30000)
// ABOUTME: Relay-only primary path; REST TODO when Funnelcake supports from_event kind 30000

import { useNostr } from '@nostrify/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { usePeopleList } from './usePeopleList';
import type { NostrEvent } from '@nostrify/nostrify';

const VIDEO_KIND = 34236;
const PAGE_SIZE = 50;
const FIRST_PAGE_CAP = 500;

/**
 * Aggregated infinite video feed for all members of a people list.
 *
 * Primary path: relay query `{ kinds: [34236], authors: members }` with
 * cursor-based (`until`) pagination.
 *
 * TODO(funnelcake): When the Funnelcake bulk endpoint supports
 * `from_event: { kind: 30000, pubkey, d_tag }`, add a REST-first path here
 * using `POST /api/videos/bulk` and fall back to relay on error / 404.
 *
 * @param pubkey - List owner's hex pubkey (pass undefined while parent is loading)
 * @param dTag   - The d-tag identifying the list (pass undefined while parent is loading)
 */
export function usePeopleListMemberVideos(
  pubkey: string | undefined,
  dTag: string | undefined,
) {
  const { nostr } = useNostr();
  const list = usePeopleList(pubkey ?? '', dTag ?? '');
  const members: string[] = list.data?.members ?? [];

  return useInfiniteQuery<NostrEvent[]>({
    queryKey: ['people-list-member-videos', pubkey, dTag, members.length],

    // Only run when the list has loaded successfully AND has at least one member
    enabled: list.isSuccess && members.length > 0,

    initialPageParam: undefined as number | undefined,

    queryFn: async ({ pageParam, signal }) => {
      // TODO(funnelcake): Try POST /api/videos/bulk with
      // `from_event: { kind: 30000, pubkey, d_tag: dTag }` when Funnelcake
      // supports kind 30000 from_event resolution.  Fall back here on error.

      const filter: {
        kinds: number[];
        authors: string[];
        limit: number;
        until?: number;
      } = {
        kinds: [VIDEO_KIND],
        authors: members,
        limit: PAGE_SIZE,
      };

      if (typeof pageParam === 'number') {
        filter.until = pageParam;
      }

      const events = await nostr.query([filter], {
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      });

      // Sort newest-first before returning — relay ordering is not guaranteed
      return events.sort((a, b) => b.created_at - a.created_at);
    },

    getNextPageParam: (lastPage, allPages) => {
      // Hard cap: stop pagination once we have accumulated FIRST_PAGE_CAP events
      const totalAccumulated = allPages.flat().length;
      if (totalAccumulated >= FIRST_PAGE_CAP) return undefined;

      // If the relay returned fewer events than PAGE_SIZE we've reached the end
      if (lastPage.length < PAGE_SIZE) return undefined;

      // Advance cursor: one second before the oldest event on this page
      const oldest = lastPage[lastPage.length - 1];
      return oldest.created_at - 1;
    },

    staleTime: 60_000,
    gcTime: 300_000,
  });
}
