import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { COLLAB_RESPONSE_KIND } from '@/lib/collabsParser';

export type CollaboratorStatus = 'pending' | 'confirmed';

export function useVideoCollaboratorStatus(
  coord: string | undefined,
  collaboratorPubkeys: string[],
) {
  const { nostr } = useNostr();
  return useQuery({
    queryKey: ['video-collab-status', coord, [...collaboratorPubkeys].sort()],
    enabled: !!coord,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      // Early return for empty collaborators list
      if (collaboratorPubkeys.length === 0) {
        return {};
      }
      const events = await nostr.query(
        [{ kinds: [COLLAB_RESPONSE_KIND], '#a': [coord!], authors: collaboratorPubkeys }],
        { signal },
      );
      const confirmedSet = new Set(events.map((e) => e.pubkey));
      const out: Record<string, CollaboratorStatus> = {};
      for (const pk of collaboratorPubkeys) {
        out[pk] = confirmedSet.has(pk) ? 'confirmed' : 'pending';
      }
      return out;
    },
  });
}
