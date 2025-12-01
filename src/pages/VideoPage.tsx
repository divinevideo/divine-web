import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useCallback, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Hash, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VideoCard } from '@/components/VideoCard';
import { useVideoNavigation } from '@/hooks/useVideoNavigation';
import { useAuthor } from '@/hooks/useAuthor';
import { useVideoSocialMetrics, useVideoUserInteractions } from '@/hooks/useVideoSocialMetrics';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useRepostVideo } from '@/hooks/usePublishVideo';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import { genUserName } from '@/lib/genUserName';
import { nip19 } from 'nostr-tools';
import { debugLog } from '@/lib/debug';
import type { ParsedVideoData } from '@/types/video';

export function VideoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // All hooks must be called before any early returns
  const {
    context,
    currentVideo,
    hasNext,
    hasPrevious,
    goToNext,
    goToPrevious,
    isLoading,
  } = useVideoNavigation(id || '');

  // Get author data for profile context
  const authorData = useAuthor(context?.pubkey || '');
  const authorName = context?.pubkey ? (authorData.data?.metadata?.name || genUserName(context.pubkey)) : null;

  // Social interaction hooks
  const [showCommentsForVideo, setShowCommentsForVideo] = useState<string | null>(null);
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { mutateAsync: repostVideo, isPending: isReposting } = useRepostVideo();

  // Keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.target !== document.body && !(event.target as Element)?.classList.contains('video-navigation-target')) {
      return; // Don't interfere with other inputs
    }

    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        if (hasPrevious) goToPrevious();
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        if (hasNext) goToNext();
        break;
    }
  }, [hasNext, hasPrevious, goToNext, goToPrevious]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Dynamic SEO meta tags for social sharing
  useSeoMeta({
    title: currentVideo?.title || 'Video on diVine',
    description: currentVideo?.content || `Watch this video${authorName ? ` by ${authorName}` : ''} on diVine`,
    ogTitle: currentVideo?.title || 'Video on diVine',
    ogDescription: currentVideo?.content || 'Watch this video on diVine',
    ogImage: currentVideo?.thumbnailUrl || '/og.png',
    ogType: 'video.other',
    twitterCard: 'summary_large_image',
    twitterTitle: currentVideo?.title || 'Video on diVine',
    twitterDescription: currentVideo?.content || 'Watch this video on diVine',
    twitterImage: currentVideo?.thumbnailUrl || '/og.png',
  });

  // Navigation back to source
  const handleGoBack = useCallback(() => {
    if (context?.source === 'hashtag' && context.hashtag) {
      navigate(`/hashtag/${context.hashtag}`);
    } else if (context?.source === 'profile' && context.pubkey) {
      try {
        const npub = nip19.npubEncode(context.pubkey);
        navigate(`/profile/${npub}`);
      } catch {
        // Fallback to hex pubkey if encoding fails
        navigate(`/profile/${context.pubkey}`);
      }
    } else {
      navigate(-1); // Browser back
    }
  }, [context, navigate]);

  // Social interaction handlers (same as VideoFeed)
  const handleLike = async (video: ParsedVideoData) => {
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'Please log in to like videos',
        variant: 'destructive',
      });
      return;
    }

    debugLog('Like video:', video.id);
    try {
      await publishEvent({
        kind: 7, // Reaction event
        content: '+', // Positive reaction
        tags: [
          ['e', video.id], // Reference to the video event
          ['p', video.pubkey], // Reference to the video author
        ],
      });

      toast({
        title: 'Liked!',
        description: 'Your reaction has been published',
      });

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['video-user-interactions', video.id] });
      // Invalidate all variants of social metrics for this video
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === 'video-social-metrics' &&
          query.queryKey[1] === video.id
      });
    } catch (error) {
      console.error('Failed to like video:', error);
      toast({
        title: 'Error',
        description: 'Failed to like video',
        variant: 'destructive',
      });
    }
  };

  const handleRepost = async (video: ParsedVideoData) => {
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'Please log in to repost videos',
        variant: 'destructive',
      });
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

    if (isReposting) return; // Prevent multiple simultaneous reposts

    debugLog('Repost video:', video.id, 'vineId:', video.vineId);
    try {
      await repostVideo({
        originalPubkey: video.pubkey,
        vineId: video.vineId,
      });

      toast({
        title: 'Reposted!',
        description: 'Video has been reposted to your feed',
      });

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['video-user-interactions', video.id] });
      // Invalidate all variants of social metrics for this video
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === 'video-social-metrics' &&
          query.queryKey[1] === video.id
      });
    } catch (error) {
      console.error('Failed to repost video:', error);
      toast({
        title: 'Error',
        description: 'Failed to repost video',
        variant: 'destructive',
      });
    }
  };

  const handleUnlike = async (likeEventId: string) => {
    if (!user) return;

    debugLog('Unlike video, deleting event:', likeEventId);
    try {
      await publishEvent({
        kind: 5, // Delete event (NIP-09)
        content: 'Unliked', // Optional reason
        tags: [
          ['e', likeEventId], // Reference to the event being deleted
        ],
      });

      toast({
        title: 'Unliked!',
        description: 'Your like has been removed',
      });

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['video-user-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['video-social-metrics'] });
    } catch (error) {
      console.error('Failed to unlike video:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove like',
        variant: 'destructive',
      });
    }
  };

  const handleUnrepost = async (repostEventId: string) => {
    if (!user) return;

    debugLog('Un-repost video, deleting event:', repostEventId);
    try {
      await publishEvent({
        kind: 5, // Delete event (NIP-09)
        content: 'Un-reposted', // Optional reason
        tags: [
          ['e', repostEventId], // Reference to the event being deleted
        ],
      });

      toast({
        title: 'Un-reposted!',
        description: 'Your repost has been removed',
      });

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['video-user-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['video-social-metrics'] });
    } catch (error) {
      console.error('Failed to un-repost video:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove repost',
        variant: 'destructive',
      });
    }
  };

  const handleOpenComments = (video: ParsedVideoData) => {
    setShowCommentsForVideo(video.id);
  };

  const handleCloseComments = () => {
    setShowCommentsForVideo(null);
  };

  // Helper component to provide social metrics data for the video
  function VideoCardWithMetrics({ video }: { video: ParsedVideoData }) {
    const { data: socialMetrics } = useVideoSocialMetrics(video.id, video.pubkey, video.vineId);
    const { data: userInteractions } = useVideoUserInteractions(video.id, video.pubkey, video.vineId, user?.pubkey);

    const handleVideoLike = async () => {
      if (userInteractions?.hasLiked) {
        // Unlike - delete the like event
        if (userInteractions.likeEventId) {
          await handleUnlike(userInteractions.likeEventId);
        }
      } else {
        // Like the video
        await handleLike(video);
      }
    };

    const handleVideoRepost = async () => {
      if (userInteractions?.hasReposted) {
        // Un-repost - delete the repost event
        if (userInteractions.repostEventId) {
          await handleUnrepost(userInteractions.repostEventId);
        }
      } else {
        // Repost the video
        await handleRepost(video);
      }
    };

    return (
      <VideoCard
        video={video}
        className="max-w-xl mx-auto"
        layout="vertical"
        onLike={handleVideoLike}
        onRepost={handleVideoRepost}
        onOpenComments={() => handleOpenComments(video)}
        onCloseComments={handleCloseComments}
        isLiked={userInteractions?.hasLiked || false}
        isReposted={userInteractions?.hasReposted || false}
        likeCount={video.likeCount ?? socialMetrics?.likeCount ?? 0}
        repostCount={video.repostCount ?? socialMetrics?.repostCount ?? 0}
        commentCount={video.commentCount ?? socialMetrics?.commentCount ?? 0}
        viewCount={socialMetrics?.viewCount || video.loopCount}
        showComments={showCommentsForVideo === video.id}
        navigationContext={context || undefined}
      />
    );
  }

  // Check for missing ID after all hooks
  if (!id) {
    return (
      <div className="container py-6">
        <Card className="border-destructive/50">
          <CardContent className="py-12 text-center">
            <p className="text-destructive">No video ID provided</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state if video not found
  if (!isLoading && !currentVideo) {
    return (
      <div className="container py-6">
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground text-lg font-semibold">Video not found</p>
            <p className="text-sm text-muted-foreground">
              This video may not exist, or the relays may be experiencing issues.
            </p>
            <p className="text-xs text-muted-foreground">
              Try checking your relay settings or refreshing the page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-6">
      {/* Subtle Navigation Context Info */}
      {context && (
        <div className="mb-4">
          <div className="text-center text-sm">
            {context.source === 'hashtag' && context.hashtag && (
              <button
                onClick={handleGoBack}
                className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 text-xs"
              >
                <Hash className="h-3 w-3" />
                #{context.hashtag}
              </button>
            )}
            {context.source === 'profile' && authorName && (
              <button
                onClick={handleGoBack}
                className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 text-xs"
              >
                <User className="h-3 w-3" />
                {authorName}
              </button>
            )}
            {(context.source === 'discovery' || context.source === 'trending' || context.source === 'home') && (
              <button
                onClick={handleGoBack}
                className="text-muted-foreground hover:text-primary transition-colors text-xs"
              >
                {context.source}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area with Click Zones */}
      <div className="relative video-navigation-target" tabIndex={0}>
        {/* Left Click Zone - pointer-events-none except for the actual button area */}
        {hasPrevious && (
          <button
            onClick={goToPrevious}
            className="absolute left-0 top-0 w-16 h-full z-10 flex items-center justify-start pl-4 opacity-0 hover:opacity-100 transition-opacity group"
            aria-label="Previous video"
          >
            <div className="bg-black/20 text-white px-2 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity">
              ←
            </div>
          </button>
        )}

        {/* Right Click Zone - pointer-events-none except for the actual button area */}
        {hasNext && (
          <button
            onClick={goToNext}
            className="absolute right-0 top-0 w-16 h-full z-10 flex items-center justify-end pr-4 opacity-0 hover:opacity-100 transition-opacity group"
            aria-label="Next video"
          >
            <div className="bg-black/20 text-white px-2 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity">
              →
            </div>
          </button>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="max-w-xl mx-auto">
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="aspect-square w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </Card>
          </div>
        )}

        {/* Video Card */}
        {currentVideo && (
          <VideoCardWithMetrics video={currentVideo} />
        )}
      </div>

      {/* Navigation Hint */}
      {(hasNext || hasPrevious) && (
        <div className="text-center mt-4">
          <div className="text-xs text-muted-foreground inline-flex items-center gap-3">
            {hasPrevious && (
              <button onClick={goToPrevious} className="hover:underline">
                ← previous
              </button>
            )}
            {hasNext && (
              <button onClick={goToNext} className="hover:underline">
                next →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoPage;