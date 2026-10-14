import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  COLLAB_RESPONSE_KIND,
  SHORT_VIDEO_KIND,
  coordOf,
  dedupeAndSubtract,
  getATagValues,
} from '@/lib/collabsParser';

export function useCollabInvites() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['collab-invites', user?.pubkey],
    enabled: !!user?.pubkey,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const me = user!.pubkey;
      const tagged = await nostr.query(
        [{ kinds: [SHORT_VIDEO_KIND], '#p': [me], limit: 100 }],
        { signal },
      );
      if (tagged.length === 0) return [];

      const coords = Array.from(new Set(tagged.map((e) => {
        try { return coordOf(e); } catch { return null; }
      }).filter((c): c is string => Boolean(c))));

      const accepted = await nostr.query(
        [{ kinds: [COLLAB_RESPONSE_KIND], authors: [me], '#a': coords }],
        { signal },
      );
      const acceptedSet = new Set(accepted.flatMap(getATagValues));
      return dedupeAndSubtract(tagged, acceptedSet, me);
    },
  });
}
