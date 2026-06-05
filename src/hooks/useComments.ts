import { NKinds, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

type UseCommentsOptions = {
  expectedCommentCount?: number;
};

type CommentsData = {
  allComments: NostrEvent[];
  topLevelComments: NostrEvent[];
};

const COMMENT_MISMATCH_RETRY_ATTEMPTS = 2;
const COMMENT_MISMATCH_REFETCH_MS = 500;

function getTagValue(event: NostrEvent, tagName: string): string | undefined {
  const tag = event.tags.find(([name]) => name === tagName);
  return tag?.[1];
}

function getAddressableId(root: NostrEvent): string {
  const d = getTagValue(root, 'd') ?? '';
  return `${root.kind}:${root.pubkey}:${d}`;
}

function buildCommentsData(root: NostrEvent | URL, events: NostrEvent[]): CommentsData {
  const topLevelComments = events.filter(comment => {
    if (root instanceof URL) {
      return getTagValue(comment, 'i') === root.toString();
    } else if (NKinds.addressable(root.kind)) {
      const addressableId = getAddressableId(root);
      const aMatch = getTagValue(comment, 'a') === addressableId;
      const eMatch = getTagValue(comment, 'e') === root.id;
      return aMatch || eMatch;
    } else if (NKinds.replaceable(root.kind)) {
      return getTagValue(comment, 'a') === `${root.kind}:${root.pubkey}:`;
    } else {
      return getTagValue(comment, 'e') === root.id;
    }
  });

  return {
    allComments: events,
    topLevelComments: topLevelComments.sort((a, b) => b.created_at - a.created_at),
  };
}

export function useComments(root: NostrEvent | URL, limit?: number, options: UseCommentsOptions = {}) {
  const { nostr } = useNostr();
  const expectedCommentCount = options.expectedCommentCount ?? 0;

  return useQuery({
    queryKey: ['nostr', 'comments', root instanceof URL ? root.toString() : root.id, limit, expectedCommentCount],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      const queryOnce = async (): Promise<CommentsData> => {
        let events: NostrEvent[];

        if (root instanceof URL) {
          const filter: NostrFilter = { kinds: [1111], '#I': [root.toString()] };
          if (typeof limit === 'number') filter.limit = limit;
          events = await nostr.query([filter], { signal });
        } else if (NKinds.addressable(root.kind)) {
          const addressableId = getAddressableId(root);

          const filterByE: NostrFilter = { kinds: [1111], '#E': [root.id] };
          const filterByA: NostrFilter = { kinds: [1111], '#A': [addressableId] };
          if (typeof limit === 'number') {
            filterByE.limit = limit;
            filterByA.limit = limit;
          }

          const [eventsE, eventsA] = await Promise.all([
            nostr.query([filterByE], { signal }),
            nostr.query([filterByA], { signal }),
          ]);

          const seenIds = new Set<string>();
          events = [...eventsE, ...eventsA].filter(e => {
            if (seenIds.has(e.id)) return false;
            seenIds.add(e.id);
            return true;
          });
        } else if (NKinds.replaceable(root.kind)) {
          const filter: NostrFilter = { kinds: [1111], '#A': [`${root.kind}:${root.pubkey}:`] };
          if (typeof limit === 'number') filter.limit = limit;
          events = await nostr.query([filter], { signal });
        } else {
          const filter: NostrFilter = { kinds: [1111], '#E': [root.id] };
          if (typeof limit === 'number') filter.limit = limit;
          events = await nostr.query([filter], { signal });
        }

        return buildCommentsData(root, events);
      };

      let commentsData = await queryOnce();

      for (
        let attempt = 1;
        expectedCommentCount > 0
          && commentsData.topLevelComments.length === 0
          && attempt < COMMENT_MISMATCH_RETRY_ATTEMPTS;
        attempt += 1
      ) {
        commentsData = await queryOnce();
      }

      return commentsData;
    },
    enabled: !!root,
    refetchInterval: (query) => {
      const data = query.state.data as CommentsData | undefined;
      return expectedCommentCount > 0 && data?.topLevelComments.length === 0
        ? COMMENT_MISMATCH_REFETCH_MS
        : false;
    },
    refetchIntervalInBackground: true,
  });
}

/**
 * Get direct replies to a comment
 */
export function getDirectReplies(allComments: NostrEvent[], commentId: string): NostrEvent[] {
  const directReplies = allComments.filter(comment => {
    const eTag = getTagValue(comment, 'e');
    return eTag === commentId;
  });
  
  // Sort by creation time (oldest first for threaded display)
  return directReplies.sort((a, b) => a.created_at - b.created_at);
}

/**
 * Get all descendants of a comment recursively
 */
export function getDescendants(allComments: NostrEvent[], commentId: string): NostrEvent[] {
  const directReplies = getDirectReplies(allComments, commentId);
  const allDescendants = [...directReplies];
  
  // Recursively get descendants of each direct reply
  for (const reply of directReplies) {
    allDescendants.push(...getDescendants(allComments, reply.id));
  }
  
  // Sort by creation time (oldest first for threaded display)
  return allDescendants.sort((a, b) => a.created_at - b.created_at);
}
