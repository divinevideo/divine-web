// ABOUTME: Hook for deleting comments using NIP-09 deletion events
// ABOUTME: Creates Kind 5 events to request deletion of user's own comments

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { debugLog, debugError } from '@/lib/debug';
import type { NostrEvent } from '@nostrify/nostrify';

interface DeleteCommentParams {
  comment: NostrEvent;
  reason?: string;
}

/**
 * Hook for deleting a comment using NIP-09
 * Only the comment author can delete their own content
 */
export function useDeleteComment() {
  const publishMutation = useNostrPublish();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ comment, reason }: DeleteCommentParams) => {
      // Verify user owns the comment
      if (!user?.pubkey) {
        throw new Error('Not logged in');
      }

      if (user.pubkey !== comment.pubkey) {
        throw new Error('You can only delete your own comments');
      }

      debugLog('[useDeleteComment] Deleting comment:', comment.id);

      // Create NIP-09 deletion event
      const deletionEvent = await publishMutation.mutateAsync({
        kind: 5, // NIP-09 deletion event
        content: reason || 'Comment deleted by author',
        tags: [
          ['e', comment.id], // Event being deleted
          ['k', String(comment.kind)], // Kind of event being deleted
        ],
      });

      if (!deletionEvent) {
        throw new Error('Failed to create deletion event');
      }

      debugLog('[useDeleteComment] Deletion event published:', deletionEvent.id);

      return {
        deleteEventId: deletionEvent.id,
        deletedCommentId: comment.id,
      };
    },
    onSuccess: (data, _variables) => {
      // Show success toast
      toast({
        title: 'Comment yanked.',
        description: 'Delete request sent to the relays.',
      });

      // Invalidate comment queries to refresh comment sections
      queryClient.invalidateQueries({ queryKey: ['comments'] });

      debugLog('[useDeleteComment] Comment deleted successfully:', data.deletedCommentId);
    },
    onError: (error: Error) => {
      debugError('[useDeleteComment] Error deleting comment:', error);

      toast({
        title: 'Delete snagged.',
        description: error.message || 'That didn\'t go through. Try again?',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook for checking if user can delete a comment
 */
export function useCanDeleteComment(comment?: NostrEvent): boolean {
  const { user } = useCurrentUser();

  if (!user?.pubkey || !comment) return false;

  // User can only delete their own comments
  return user.pubkey === comment.pubkey;
}
