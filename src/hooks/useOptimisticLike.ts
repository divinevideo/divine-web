// ABOUTME: Hook for optimistic like updates
// ABOUTME: Updates UI immediately before server confirms the action

import { useQueryClient } from '@tanstack/react-query';
import { UserInteractions } from '@/types/video';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { debugLog } from '@/lib/debug';
import type { VideoSocialMetrics } from '@/hooks/useVideoSocialMetrics';

interface OptimisticLikeParams {
  videoId: string;
  videoPubkey: string;
  vineId: string | null;
  userPubkey: string;
  isCurrentlyLiked: boolean;
  currentLikeEventId: string | null;
}

export function useOptimisticLike() {
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  const toggleLike = async ({
    videoId,
    videoPubkey,
    vineId,
    userPubkey,
    isCurrentlyLiked,
    currentLikeEventId,
  }: OptimisticLikeParams) => {
    const metricsQueryKey = ['video-social-metrics', videoId, videoPubkey, vineId];
    const interactionsQueryKey = ['video-user-interactions', videoId, userPubkey];

    // Store previous state for rollback
    const previousMetrics = queryClient.getQueryData(metricsQueryKey);
    const previousInteractions = queryClient.getQueryData(interactionsQueryKey);

    try {
      if (isCurrentlyLiked) {
        // Optimistic unlike
        queryClient.setQueryData(metricsQueryKey, (old: VideoSocialMetrics | undefined) => ({
          ...old,
          likeCount: Math.max(0, (old?.likeCount || 0) - 1),
        }));
        queryClient.setQueryData(interactionsQueryKey, (old: UserInteractions | undefined) => ({
          ...old,
          hasLiked: false,
          likeEventId: null,
        }));

        debugLog('Optimistically unliking video:', videoId);

        // Actually delete the like event
        if (currentLikeEventId) {
          await publishEvent({
            kind: 5, // Delete event (NIP-09)
            content: 'Unliked',
            tags: [['e', currentLikeEventId]],
          });
        }

        toast({
          title: 'Unliked!',
          description: 'Your like has been removed',
        });
      } else {
        // Optimistic like
        queryClient.setQueryData(metricsQueryKey, (old: VideoSocialMetrics | undefined) => ({
          ...old,
          likeCount: (old?.likeCount || 0) + 1,
        }));
        queryClient.setQueryData(interactionsQueryKey, (old: UserInteractions | undefined) => ({
          ...old,
          hasLiked: true,
          likeEventId: 'pending', // Temporary ID until real one comes back
        }));

        debugLog('Optimistically liking video:', videoId);

        // Actually publish the like event
        const event = await publishEvent({
          kind: 7, // Reaction event
          content: '+',
          tags: [
            ['e', videoId],
            ['p', videoPubkey],
          ],
        });

        // Update with real event ID
        queryClient.setQueryData(interactionsQueryKey, (old: UserInteractions | undefined) => ({
          ...old,
          likeEventId: event.id,
        }));

        toast({
          title: 'Liked!',
          description: 'Your reaction has been published',
        });
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);

      // Rollback on error
      queryClient.setQueryData(metricsQueryKey, previousMetrics);
      queryClient.setQueryData(interactionsQueryKey, previousInteractions);

      toast({
        title: 'Error',
        description: `Failed to ${isCurrentlyLiked ? 'unlike' : 'like'} video`,
        variant: 'destructive',
      });
    }
  };

  return { toggleLike };
}
