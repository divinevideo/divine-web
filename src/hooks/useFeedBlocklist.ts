// ABOUTME: Hook assembling the per-viewer feed blocklist: own mutes/blocks plus authors who
// ABOUTME: muted (kind 10000) or blocked (kind 30000 d=block) the viewer. Fails open on relay errors.

import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { NostrFilter } from '@nostrify/nostrify';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMuteList, MUTE_LIST_KIND } from '@/hooks/useModeration';
import { MuteType } from '@/types/moderation';
import {
  BLOCK_LIST_KIND,
  buildFeedBlocklist,
  parseBlockersOfViewer,
  parseMutersOfViewer,
  parseOwnBlockedPubkeys,
} from '@/lib/blocklistFilter';
import { debugError } from '@/lib/debug';

interface ViewerTargetedLists {
  mutersOfViewer: string[];
  blockersOfViewer: string[];
  ownBlockedPubkeys: string[];
}

const EMPTY_LISTS: ViewerTargetedLists = {
  mutersOfViewer: [],
  blockersOfViewer: [],
  ownBlockedPubkeys: [],
};

// Stable empty set so logged-out consumers never re-render on identity changes
const EMPTY_BLOCKLIST: ReadonlySet<string> = new Set();

/**
 * The set of pubkeys whose videos must be hidden from feed surfaces for the
 * current viewer (parity with divine-mobile's shouldFilterFromFeeds):
 * - pubkeys the viewer muted (own kind 10000 mute list, via useMuteList)
 * - pubkeys the viewer blocked (own kind 30000 d=block list)
 * - authors whose kind 10000 mute list p-tags the viewer
 * - authors whose kind 30000 d=block list p-tags the viewer
 *
 * Funnelcake REST feeds apply platform moderation only — per-viewer block/mute
 * filtering is a client responsibility (divine-web#399).
 *
 * Fails open: relay errors/timeouts yield an empty set so feeds render
 * unfiltered rather than blank.
 */
export function useFeedBlocklist(): ReadonlySet<string> {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const viewerPubkey = user?.pubkey;

  // Own kind 10000 mutes come from useMuteList so mute/unmute mutations
  // (which invalidate ['mute-list']) update the feed filter immediately.
  const { data: muteList } = useMuteList();

  const { data: targeted = EMPTY_LISTS } = useQuery({
    queryKey: ['feed-blocklist', viewerPubkey],
    queryFn: async (context): Promise<ViewerTargetedLists> => {
      if (!viewerPubkey) return EMPTY_LISTS;

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(8000),
      ]);

      const filters: NostrFilter[] = [
        // Authors who muted or blocked the viewer. The d=block check happens
        // client-side because not all relays support #d filtering.
        { kinds: [MUTE_LIST_KIND, BLOCK_LIST_KIND], '#p': [viewerPubkey], limit: 1000 },
        // The viewer's own kind 30000 d=block list (published by Divine mobile)
        { kinds: [BLOCK_LIST_KIND], authors: [viewerPubkey], limit: 10 },
      ];

      try {
        const events = await nostr.query(filters, { signal });
        return {
          mutersOfViewer: parseMutersOfViewer(events, viewerPubkey),
          blockersOfViewer: parseBlockersOfViewer(events, viewerPubkey),
          ownBlockedPubkeys: parseOwnBlockedPubkeys(events, viewerPubkey),
        };
      } catch (err) {
        // Fail open: an unreachable relay must not blank the feed.
        debugError('[useFeedBlocklist] blocklist query failed, showing feed unfiltered:', err);
        return EMPTY_LISTS;
      }
    },
    enabled: !!viewerPubkey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  return useMemo(() => {
    if (!viewerPubkey) return EMPTY_BLOCKLIST;
    const ownMutedPubkeys = (muteList ?? [])
      .filter(item => item.type === MuteType.USER)
      .map(item => item.value);
    return buildFeedBlocklist({
      viewerPubkey,
      ownMutedPubkeys,
      ownBlockedPubkeys: targeted.ownBlockedPubkeys,
      mutersOfViewer: targeted.mutersOfViewer,
      blockersOfViewer: targeted.blockersOfViewer,
    });
  }, [viewerPubkey, muteList, targeted]);
}
