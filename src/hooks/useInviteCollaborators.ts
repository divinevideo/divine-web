import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { dTagOf, SHORT_VIDEO_KIND } from '@/lib/collabsParser';

interface CollabAddition {
  pubkey: string;
  role?: string;
}

interface InviteArgs {
  original: NostrEvent;
  additions: CollabAddition[];
}

export function useInviteCollaborators() {
  const { nostr } = useNostr();
  const publish = useNostrPublish();
  const qc = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ original, additions }: InviteArgs) => {
      const me = user?.pubkey;
      if (!me) throw new Error('Not logged in');

      const dTag = dTagOf(original);

      const latestList = await nostr.query(
        [{ kinds: [SHORT_VIDEO_KIND], authors: [me], '#d': [dTag], limit: 1 }],
        {},
      );
      const latest = latestList
        .sort((a, b) => b.created_at - a.created_at)[0] ?? original;

      const existingP = new Set(
        latest.tags.filter((t) => t[0] === 'p' && t[1]).map((t) => t[1]),
      );
      const newPTags = additions
        .filter((a) => !existingP.has(a.pubkey))
        .map((a) => a.role ? ['p', a.pubkey, a.role] : ['p', a.pubkey]);

      if (newPTags.length === 0) return null;

      const event = await publish.mutateAsync({
        kind: SHORT_VIDEO_KIND,
        content: latest.content,
        tags: [...latest.tags, ...newPTags],
        created_at: Math.floor(Date.now() / 1000),
      });
      return event;
    },
    onSuccess: () => {
      const me = user?.pubkey;
      if (!me) return;
      qc.invalidateQueries({ queryKey: ['user-videos', me] });
      qc.invalidateQueries({ queryKey: ['video-collab-status'] });
    },
  });
}
