import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { buildNip22CommentTags } from '@/lib/buildNip22CommentTags';
import type { NostrEvent } from '@nostrify/nostrify';

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
      const tags = buildNip22CommentTags(root, reply);

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