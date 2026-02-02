import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { NKinds, type NostrEvent } from '@nostrify/nostrify';

interface PostCommentParams {
  root: NostrEvent | URL; // The root event to comment on
  reply?: NostrEvent | URL; // Optional reply to another comment
  content: string;
}

type CommentsQueryData = {
  allComments: NostrEvent[];
  topLevelComments: NostrEvent[];
};

/** Post a NIP-22 (kind 1111) comment on an event. */
export function usePostComment() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ root, reply, content }: PostCommentParams) => {
      const tags: string[][] = [];

      // d-tag identifiers
      const dRoot = root instanceof URL ? '' : root.tags.find(([name]) => name === 'd')?.[1] ?? '';
      const dReply = reply instanceof URL ? '' : reply?.tags.find(([name]) => name === 'd')?.[1] ?? '';

      // Root event tags
      if (root instanceof URL) {
        tags.push(['I', root.toString()]);
      } else if (NKinds.addressable(root.kind)) {
        tags.push(['A', `${root.kind}:${root.pubkey}:${dRoot}`]);
        // Also include E tag for event ID - Funnelcake indexes by this
        tags.push(['E', root.id]);
      } else if (NKinds.replaceable(root.kind)) {
        tags.push(['A', `${root.kind}:${root.pubkey}:`]);
      } else {
        tags.push(['E', root.id]);
      }
      if (root instanceof URL) {
        tags.push(['K', root.hostname]);
      } else {
        tags.push(['K', root.kind.toString()]);
        tags.push(['P', root.pubkey]);
      }

      // Reply event tags
      if (reply) {
        if (reply instanceof URL) {
          tags.push(['i', reply.toString()]);
        } else if (NKinds.addressable(reply.kind)) {
          tags.push(['a', `${reply.kind}:${reply.pubkey}:${dReply}`]);
        } else if (NKinds.replaceable(reply.kind)) {
          tags.push(['a', `${reply.kind}:${reply.pubkey}:`]);
        } else {
          tags.push(['e', reply.id]);
        }
        if (reply instanceof URL) {
          tags.push(['k', reply.hostname]);
        } else {
          tags.push(['k', reply.kind.toString()]);
          tags.push(['p', reply.pubkey]);
        }
      } else {
        // If this is a top-level comment, use the root event's tags
        if (root instanceof URL) {
          tags.push(['i', root.toString()]);
        } else if (NKinds.addressable(root.kind)) {
          tags.push(['a', `${root.kind}:${root.pubkey}:${dRoot}`]);
          // Also include e tag for event ID - ensures comment is found by #E queries
          tags.push(['e', root.id]);
        } else if (NKinds.replaceable(root.kind)) {
          tags.push(['a', `${root.kind}:${root.pubkey}:`]);
        } else {
          tags.push(['e', root.id]);
        }
        if (root instanceof URL) {
          tags.push(['k', root.hostname]);
        } else {
          tags.push(['k', root.kind.toString()]);
          tags.push(['p', root.pubkey]);
        }
      }

      const event = await publishEvent({
        kind: 1111,
        content,
        tags,
      });

      return event;
    },
    onMutate: async ({ root, reply, content }) => {
      const rootId = root instanceof URL ? root.toString() : root.id;
      
      // Cancel all comment queries for this root (they may have different limits)
      await queryClient.cancelQueries({ queryKey: ['nostr', 'comments', rootId] });
      
      // Find all cached comment queries for this root
      const allQueries = queryClient.getQueriesData<CommentsQueryData>({ 
        queryKey: ['nostr', 'comments', rootId] 
      });
      
      // Create optimistic comment
      const optimisticComment = {
        id: `temp-${Date.now()}`,
        pubkey: user?.pubkey || '',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1111,
        tags: reply && !(reply instanceof URL) ? [['e', reply.id]] : [],
        content,
        sig: '',
        _optimistic: true,
      } as NostrEvent & { _optimistic: boolean };
      
      // Update all cached queries with optimistic comment
      allQueries.forEach(([queryKey, previousData]) => {
        if (previousData) {
          queryClient.setQueryData<CommentsQueryData>(queryKey, {
            allComments: [optimisticComment, ...previousData.allComments],
            topLevelComments: !reply 
              ? [optimisticComment, ...previousData.topLevelComments]
              : previousData.topLevelComments,
          });
        }
      });
      
      return { previousQueries: allQueries, optimisticId: optimisticComment.id };
    },
    onSuccess: (newEvent, { root }, context) => {
      const rootId = root instanceof URL ? root.toString() : root.id;
      
      // Replace optimistic comment with real event in all cached queries
      const allQueries = queryClient.getQueriesData<CommentsQueryData>({ 
        queryKey: ['nostr', 'comments', rootId] 
      });
      
      allQueries.forEach(([queryKey, previousData]) => {
        if (previousData && context) {
          queryClient.setQueryData<CommentsQueryData>(queryKey, {
            allComments: [
              newEvent,
              ...previousData.allComments.filter(c => c.id !== context.optimisticId)
            ],
            topLevelComments: previousData.topLevelComments.some(c => c.id === context.optimisticId)
              ? [newEvent, ...previousData.topLevelComments.filter(c => c.id !== context.optimisticId)]
              : previousData.topLevelComments,
          });
        }
      });
      
      // Schedule background refetch after relay's OpenSearch index refresh (5s interval + 1s buffer)
      // Don't refetch immediately - the relay index hasn't refreshed yet
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['nostr', 'comments', rootId] });
      }, 6000);
    },
    onError: (err, variables, context) => {
      // Rollback optimistic updates on all queries
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, previousData]) => {
          if (previousData) {
            queryClient.setQueryData(queryKey, previousData);
          }
        });
      }
    },
  });
}