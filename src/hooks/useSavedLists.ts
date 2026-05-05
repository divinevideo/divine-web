// ABOUTME: Hook for reading kind 30003 'saved-lists' event and parsing addressable list refs
// ABOUTME: Returns refs to all people lists (30000) and playlists (30005) saved by the current user

import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export type SavedListRef = { kind: 30000 | 30005; pubkey: string; dTag: string };

const HEX64 = /^[0-9a-f]{64}$/i;
const ALLOWED_KINDS = new Set([30000, 30005]);

function parseATag(value: string): SavedListRef | null {
  const parts = value.split(':');
  if (parts.length !== 3) return null;

  const [kindStr, pubkey, dTag] = parts;
  const kind = Number(kindStr);

  if (!ALLOWED_KINDS.has(kind)) return null;
  if (!HEX64.test(pubkey)) return null;
  if (!dTag) return null;

  return { kind: kind as 30000 | 30005, pubkey, dTag };
}

export function useSavedLists() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<SavedListRef[]>({
    queryKey: ['saved-lists', user?.pubkey ?? ''],
    enabled: !!user,

    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [{ kinds: [30003], authors: [user!.pubkey], '#d': ['saved-lists'], limit: 1 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) },
      );

      if (events.length === 0) return [];

      // Take most recent (kind 30003 is addressable/replaceable)
      const event = events.sort((a, b) => b.created_at - a.created_at)[0];

      const refs: SavedListRef[] = [];
      for (const tag of event.tags) {
        if (tag[0] !== 'a' || !tag[1]) continue;
        const ref = parseATag(tag[1]);
        if (ref) refs.push(ref);
      }

      return refs;
    },

    staleTime: 60_000,
  });
}
