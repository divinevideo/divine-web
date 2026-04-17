// ABOUTME: Hook for optimistic repost updates
// ABOUTME: Updates UI immediately before server confirms the action

import { useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useRepostVideo } from '@/hooks/usePublishVideo';
import { useToast } from '@/hooks/useToast';
import { debugLog } from '@/lib/debug';
import type { VideoSocialMetrics } from '@/hooks/useVideoSocialMetrics';

interface OptimisticRepostParams {
  videoId: string;
  videoPubkey: string;
  vineId: string;
  userPubkey: string;
  isCurrentlyReposted: boolean;
  currentRepostEventId: string | null;
}

interface UserInteractions {
  hasLiked: boolean;
  hasReposted: boolean;
  likeEventId: string | null;
  repostEventId: string | null;
}

export function useOptimisticRepost() {
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { mutateAsync: repostVideo } = useRepostVideo();
  const { toast } = useToast();

  const toggleRepost = async ({
    videoId,
    videoPubkey,
    vineId,
    userPubkey,
    isCurrentlyReposted,
    currentRepostEventId,
  }: OptimisticRepostParams) => {
    const metricsQueryKey = ['video-social-metrics', videoId, videoPubkey, vineId];
    const interactionsQueryKey = ['video-user-interactions', videoId, userPubkey];

    // Store previous state for rollback
    const previousMetrics = queryClient.getQueryData(metricsQueryKey);
    const previousInteractions = queryClient.getQueryData(interactionsQueryKey);

    try {
      if (isCurrentlyReposted) {
        // Optimistic un-repost
        queryClient.setQueryData(metricsQueryKey, (old: VideoSocialMetrics | undefined) => ({
          ...old,
          repostCount: Math.max(0, (old?.repostCount || 0) - 1),
        }));
        queryClient.setQueryData(interactionsQueryKey, (old: UserInteractions | undefined) => ({
          ...old,
          hasReposted: false,
          repostEventId: null,
        }));

        debugLog('Optimistically un-reposting video:', videoId);

        // Actually delete the repost event
        if (currentRepostEventId) {
          await publishEvent({
            kind: 5, // Delete event (NIP-09)
            content: 'Un-reposted',
            tags: [['e', currentRepostEventId]],
          });
        }

        toast({
          title: 'Un-reposted.',
          description: 'Pulled it back. No sweat.',
        });
      } else {
        // Optimistic repost
        queryClient.setQueryData(metricsQueryKey, (old: VideoSocialMetrics | undefined) => ({
          ...old,
          repostCount: (old?.repostCount || 0) + 1,
        }));
        queryClient.setQueryData(interactionsQueryKey, (old: UserInteractions | undefined) => ({
          ...old,
          hasReposted: true,
          repostEventId: 'pending', // Temporary ID until real one comes back
        }));

        debugLog('Optimistically reposting video:', videoId);

        // Actually publish the repost event
        const event = await repostVideo({
          originalPubkey: videoPubkey,
          vineId: vineId,
        });

        // Update with real event ID
        queryClient.setQueryData(interactionsQueryKey, (old: UserInteractions | undefined) => ({
          ...old,
          repostEventId: event.id,
        }));

        toast({
          title: 'Reposted.',
          description: 'Sharing the love with your feed.',
        });
      }
    } catch (error) {
      console.error('Failed to toggle repost:', error);

      // Rollback on error
      queryClient.setQueryData(metricsQueryKey, previousMetrics);
      queryClient.setQueryData(interactionsQueryKey, previousInteractions);

      toast({
        title: 'Error',
        description: `Failed to ${isCurrentlyReposted ? 'remove repost' : 'repost video'}`,
        variant: 'destructive',
      });
    }
  };

  return { toggleRepost };
}
