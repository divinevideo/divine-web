import { NKinds, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

export function useComments(root: NostrEvent | URL, limit?: number) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nostr', 'comments', root instanceof URL ? root.toString() : root.id, limit],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      let events: NostrEvent[];

      if (root instanceof URL) {
        const filter: NostrFilter = { kinds: [1111], '#I': [root.toString()] };
        if (typeof limit === 'number') filter.limit = limit;
        events = await nostr.query([filter], { signal });
      } else if (NKinds.addressable(root.kind)) {
        // For addressable events, query by BOTH #E (event ID) and #A (addressable identifier)
        // Funnelcake indexes by E tag, but NIP-22 standard uses A tag for addressable events
        const d = root.tags.find(([name]) => name === 'd')?.[1] ?? '';
        const addressableId = `${root.kind}:${root.pubkey}:${d}`;

        const filterByE: NostrFilter = { kinds: [1111], '#E': [root.id] };
        const filterByA: NostrFilter = { kinds: [1111], '#A': [addressableId] };
        if (typeof limit === 'number') {
          filterByE.limit = limit;
          filterByA.limit = limit;
        }

        // Run both queries in parallel and merge results
        const [eventsE, eventsA] = await Promise.all([
          nostr.query([filterByE], { signal }),
          nostr.query([filterByA], { signal }),
        ]);

        // Deduplicate by event ID
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

      // Helper function to get tag value
      const getTagValue = (event: NostrEvent, tagName: string): string | undefined => {
        const tag = event.tags.find(([name]) => name === tagName);
        return tag?.[1];
      };

      // Filter top-level comments (those with lowercase tag matching the root)
      const topLevelComments = events.filter(comment => {
        if (root instanceof URL) {
          return getTagValue(comment, 'i') === root.toString();
        } else if (NKinds.addressable(root.kind)) {
          const d = getTagValue(root, 'd') ?? '';
          const addressableId = `${root.kind}:${root.pubkey}:${d}`;
          // Top-level if parent matches root via either 'a' tag (addressable) or 'e' tag (event ID)
          const aMatch = getTagValue(comment, 'a') === addressableId;
          const eMatch = getTagValue(comment, 'e') === root.id;
          return aMatch || eMatch;
        } else if (NKinds.replaceable(root.kind)) {
          return getTagValue(comment, 'a') === `${root.kind}:${root.pubkey}:`;
        } else {
          return getTagValue(comment, 'e') === root.id;
        }
      });

      // Sort top-level comments by creation time (newest first)
      const sortedTopLevel = topLevelComments.sort((a, b) => b.created_at - a.created_at);

      return {
        allComments: events,
        topLevelComments: sortedTopLevel,
      };
    },
    enabled: !!root,
  });
}

/**
 * Get direct replies to a comment
 */
export function getDirectReplies(allComments: NostrEvent[], commentId: string): NostrEvent[] {
  const getTagValue = (event: NostrEvent, tagName: string): string | undefined => {
    const tag = event.tags.find(([name]) => name === tagName);
    return tag?.[1];
  };
  
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