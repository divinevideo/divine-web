import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { COLLAB_RESPONSE_KIND, SHORT_VIDEO_KIND } from '@/lib/collabsParser';

interface ApproveArgs {
  creatorPubkey: string;
  videoDTag: string;
}

export function useApproveCollab() {
  const publish = useNostrPublish();
  const qc = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ creatorPubkey, videoDTag }: ApproveArgs) => {
      const coord = `${SHORT_VIDEO_KIND}:${creatorPubkey}:${videoDTag}`;
      return publish.mutateAsync({
        kind: COLLAB_RESPONSE_KIND,
        content: '',
        tags: [
          ['a', coord],
          ['d', crypto.randomUUID()],
        ],
      });
    },
    onSuccess: () => {
      const me = user?.pubkey;
      if (!me) return;
      qc.invalidateQueries({ queryKey: ['collab-invites', me] });
      qc.invalidateQueries({ queryKey: ['user-collabs', me] });
    },
  });
}
