// ABOUTME: Wrapper component that adds social metrics to VideoCard
// ABOUTME: MUST be defined outside of parent component to prevent remounting on re-renders

import { VideoCard } from '@/components/VideoCard';
import { useDeferredVideoMetrics } from '@/hooks/useDeferredVideoMetrics';
import { useOptimisticLike } from '@/hooks/useOptimisticLike';
import { useOptimisticRepost } from '@/hooks/useOptimisticRepost';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { useLoginDialog } from '@/contexts/LoginDialogContext';
import { debugLog } from '@/lib/debug';
import type { ParsedVideoData } from '@/types/video';
import type { VideoNavigationContext } from '@/hooks/useVideoNavigation';
import React from 'react';

interface VideoCardWithMetricsProps {
  video: ParsedVideoData;
  index: number;
  mode?: 'auto-play' | 'thumbnail';
  showComments: boolean;
  onOpenComments: () => void;
  onCloseComments: () => void;
  onEnterFullscreen?: () => void;
  navigationContext?: VideoNavigationContext;
}

// IMPORTANT: This component is defined at module level to prevent React from
// unmounting/remounting it when parent re-renders. Defining components inside
// other components causes React to see them as new types on each render.
function VideoCardWithMetricsInner({
  video,
  index,
  mode = 'auto-play',
  showComments,
  onOpenComments,
  onCloseComments,
  onEnterFullscreen,
  navigationContext,
}: VideoCardWithMetricsProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { toggleLike } = useOptimisticLike();
  const { toggleRepost } = useOptimisticRepost();
  const { openLoginDialog } = useLoginDialog();

  // Use deferred loading: render video immediately, load metrics after a short delay
  // First 3 videos load immediately, rest have a staggered delay for progressive enhancement
  const delay = index < 3 ? 0 : Math.min(index * 50, 500);
  const { socialMetrics, userInteractions } = useDeferredVideoMetrics({
    videoId: video.id,
    videoPubkey: video.pubkey,
    vineId: video.vineId,
    userPubkey: user?.pubkey,
    delay,
    immediate: index < 3, // Load first 3 immediately for perceived speed
  });

  const handleVideoLike = async () => {
    // Check authentication first, show login dialog if not authenticated
    if (!user) {
      openLoginDialog();
      return;
    }

    debugLog('Toggle like for video:', video.id);
    await toggleLike({
      videoId: video.id,
      videoPubkey: video.pubkey,
      vineId: video.vineId,
      userPubkey: user.pubkey,
      isCurrentlyLiked: userInteractions.data?.hasLiked || false,
      currentLikeEventId: userInteractions.data?.likeEventId || null,
    });
  };

  const handleVideoRepost = async () => {
    // Check authentication first, show login dialog if not authenticated
    if (!user) {
      openLoginDialog();
      return;
    }

    if (!video.vineId) {
      toast({
        title: 'Error',
        description: 'Cannot repost this video',
        variant: 'destructive',
      });
      return;
    }

    debugLog('Toggle repost for video:', video.id);
    await toggleRepost({
      videoId: video.id,
      videoPubkey: video.pubkey,
      vineId: video.vineId,
      userPubkey: user.pubkey,
      isCurrentlyReposted: userInteractions.data?.hasReposted || false,
      currentRepostEventId: userInteractions.data?.repostEventId || null,
    });
  };

  return (
    <VideoCard
      video={video}
      mode={mode}
      onLike={handleVideoLike}
      onRepost={handleVideoRepost}
      onOpenComments={onOpenComments}
      onCloseComments={onCloseComments}
      onEnterFullscreen={onEnterFullscreen}
      isLiked={userInteractions.data?.hasLiked || false}
      isReposted={userInteractions.data?.hasReposted || false}
      likeCount={(video.likeCount ?? 0) + (socialMetrics.data?.likeCount ?? 0)}
      repostCount={(video.repostCount ?? 0) + (socialMetrics.data?.repostCount ?? 0)}
      commentCount={(video.commentCount ?? 0) + (socialMetrics.data?.commentCount ?? 0)}
      viewCount={(socialMetrics.data?.viewCount ?? 0) + (video.loopCount ?? 0)}
      showComments={showComments}
      navigationContext={navigationContext}
      videoIndex={index}
      data-testid="video-card"
    />
  );
}

// Use React.memo to prevent unnecessary re-renders when props haven't changed
export const VideoCardWithMetrics = React.memo(VideoCardWithMetricsInner);
