import { useParams, useSearchParams } from 'react-router-dom';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Hash, User, X, Loader2 } from 'lucide-react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { VideoCard } from '@/components/VideoCard';
import { useVideoNavigation, type VideoNavigationContext } from '@/hooks/useVideoNavigation';
import { useVideoByIdFunnelcake } from '@/hooks/useVideoByIdFunnelcake';
import { useAuthor } from '@/hooks/useAuthor';
import { useBatchedVideoInteractions } from '@/hooks/useBatchedVideoInteractions';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useRepostVideo } from '@/hooks/usePublishVideo';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import { genUserName } from '@/lib/genUserName';
import { nip19 } from 'nostr-tools';
import { debugLog } from '@/lib/debug';
import type { ParsedVideoData, UserInteractions } from '@/types/video';

export function VideoPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useSubdomainNavigate();

  // Parse navigation context from URL params
  const context: VideoNavigationContext | null = useMemo(() => {
    const source = searchParams.get('source') as VideoNavigationContext['source'];
    if (!source) return null;

    return {
      source,
      hashtag: searchParams.get('hashtag') || undefined,
      pubkey: searchParams.get('pubkey') || undefined,
      currentIndex: searchParams.get('index') ? parseInt(searchParams.get('index')!) : undefined,
    };
  }, [searchParams]);

  // Fast video loading via Funnelcake REST API
  const {
    video: funnelcakeVideo,
    videos: funnelcakeVideos,
    isLoading: funnelcakeLoading,
  } = useVideoByIdFunnelcake({
    videoId: id || '',
    pubkey: context?.pubkey,
    hashtag: context?.hashtag,
    enabled: !!id,
  });

  // Fallback to WebSocket-based navigation (slower but handles all cases)
  const {
    context: _wsContext,
    currentVideo: wsVideo,
    videos: wsVideos,
    hasNext: _wsHasNext,
    hasPrevious: _wsHasPrevious,
    goToNext: _wsGoToNext,
    goToPrevious: _wsGoToPrevious,
    isLoading: wsLoading,
  } = useVideoNavigation(id || '');

  // ALWAYS prefer Funnelcake REST API first - it's much faster
  // Loop counts are parsed from content field by funnelcakeTransform
  // WebSocket is only used as fallback when Funnelcake fails
  const currentVideo = funnelcakeVideo || wsVideo;
  const videos = funnelcakeVideos || wsVideos;
  const isLoading = funnelcakeLoading && wsLoading;

  // Calculate navigation state from available videos
  const currentIndex = useMemo(() => {
    if (!videos || !id) return -1;
    return videos.findIndex(v => v.id === id || v.vineId === id);
  }, [videos, id]);

  const hasNext = currentIndex >= 0 && currentIndex < (videos?.length || 0) - 1;
  const hasPrevious = currentIndex > 0;

  // Build navigation URL
  const buildNavigationUrl = useCallback((video: ParsedVideoData, index: number) => {
    if (!context) return `/video/${video.id}`;

    const params = new URLSearchParams({
      source: context.source,
      index: index.toString(),
    });

    if (context.hashtag) params.set('hashtag', context.hashtag);
    if (context.pubkey) params.set('pubkey', context.pubkey);

    return `/video/${video.id}?${params.toString()}`;
  }, [context]);

  const goToNext = useCallback(() => {
    if (!hasNext || !videos) return;
    const nextVideo = videos[currentIndex + 1];
    navigate(buildNavigationUrl(nextVideo, currentIndex + 1));
  }, [hasNext, videos, currentIndex, navigate, buildNavigationUrl]);

  const goToPrevious = useCallback(() => {
    if (!hasPrevious || !videos) return;
    const prevVideo = videos[currentIndex - 1];
    navigate(buildNavigationUrl(prevVideo, currentIndex - 1));
  }, [hasPrevious, videos, currentIndex, navigate, buildNavigationUrl]);

  // Get author data for profile context
  // Prefer cached author name from video/Funnelcake, then fetched profile, then generated fallback
  const authorData = useAuthor(context?.pubkey || '', {
    initialName: currentVideo?.authorName,
    initialAvatar: currentVideo?.authorAvatar,
  });
  const authorName = context?.pubkey
    ? (authorData.data?.metadata?.display_name || authorData.data?.metadata?.name || currentVideo?.authorName || genUserName(context.pubkey))
    : null;

  // Progressive rendering: only render a window of videos, expand on scroll
  const INITIAL_RENDER_COUNT = 10;
  const LOAD_MORE_COUNT = 10;
  const [maxRendered, setMaxRendered] = useState(INITIAL_RENDER_COUNT);

  // Ensure we always render at least up to the current video + buffer
  useEffect(() => {
    if (currentIndex >= 0) {
      setMaxRendered(prev => Math.max(prev, currentIndex + 5));
    }
  }, [currentIndex]);

  const visibleVideos = useMemo(() => {
    if (!videos) return [];
    return videos.slice(0, maxRendered);
  }, [videos, maxRendered]);

  const hasMoreToShow = maxRendered < (videos?.length || 0);

  const showMoreVideos = useCallback(() => {
    setMaxRendered(prev => Math.min(prev + LOAD_MORE_COUNT, videos?.length || 0));
  }, [videos?.length]);

  // Batch fetch user interactions only for VISIBLE videos (not all)
  const videosForInteractions = useMemo(() => {
    return visibleVideos.map(v => ({
      id: v.id,
      pubkey: v.pubkey,
      vineId: v.vineId,
    }));
  }, [visibleVideos]);

  // Social interaction hooks
  const [showCommentsForVideo, setShowCommentsForVideo] = useState<string | null>(null);
  const { user } = useCurrentUser();

  // Batch fetch all user interactions in ONE query instead of per-video
  const { interactions: batchedInteractions } = useBatchedVideoInteractions(
    videosForInteractions,
    user?.pubkey
  );
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
    ogImage: currentVideo?.thumbnailUrl || '/og.avif',
    ogType: 'video.other',
    twitterCard: 'summary_large_image',
    twitterTitle: currentVideo?.title || 'Video on diVine',
    twitterDescription: currentVideo?.content || 'Watch this video on diVine',
    twitterImage: currentVideo?.thumbnailUrl || '/og.avif',
  });

  // Navigation back to source
  const handleGoBack = useCallback(() => {
    if (context?.source === 'hashtag' && context.hashtag) {
      navigate(`/hashtag/${context.hashtag}`);
    } else if (context?.source === 'profile' && context.pubkey) {
      try {
        const npub = nip19.npubEncode(context.pubkey);
        navigate(`/profile/${npub}`, { ownerPubkey: context.pubkey });
      } catch {
        navigate(`/profile/${context.pubkey}`, { ownerPubkey: context.pubkey });
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
  // Uses pre-fetched batched interactions instead of individual queries per video
  function VideoCardWithMetrics({ video, userInteractions }: { video: ParsedVideoData; userInteractions?: UserInteractions }) {
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
        likeCount={video.likeCount ?? 0}
        repostCount={video.repostCount ?? 0}
        commentCount={video.commentCount ?? 0}
        viewCount={video.loopCount ?? 0}
        showComments={showCommentsForVideo === video.id}
        navigationContext={context || undefined}
      />
    );
  }

  // Ref for scrolling to the initial video
  const initialVideoRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  // Track when the primary video has loaded - delay rendering others until then
  const [primaryVideoLoaded, setPrimaryVideoLoaded] = useState(false);

  // Reset primary loaded state when video changes
  useEffect(() => {
    setPrimaryVideoLoaded(false);
    // Mark as loaded after a short delay to allow video to start loading
    const timer = setTimeout(() => setPrimaryVideoLoaded(true), 500);
    return () => clearTimeout(timer);
  }, [id]);

  // Scroll to the initial video when feed mode loads
  useEffect(() => {
    if (context && videos && videos.length > 1 && currentIndex >= 0 && !hasScrolledRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initialVideoRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
        hasScrolledRef.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [context, videos, currentIndex]);

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

  // Feed mode: show all videos in a scrollable list when we have context
  // Show feed mode immediately when we have context, even while loading
  const showFeedMode = context && (videos?.length ?? 0) > 0;
  const showFeedLoading = context && isLoading && !videos?.length;

  if (showFeedLoading) {
    // Show feed-style loading when we have context but videos haven't loaded yet
    return (
      <div className="container py-6">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b pb-3 mb-4 -mx-4 px-4">
          <div className="flex items-center justify-between max-w-xl mx-auto">
            <button
              onClick={handleGoBack}
              className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2 text-sm font-medium"
            >
              {context.source === 'hashtag' && context.hashtag && (
                <>
                  <Hash className="h-4 w-4" />
                  #{context.hashtag}
                </>
              )}
              {context.source === 'profile' && (
                <>
                  <User className="h-4 w-4" />
                  Loading videos...
                </>
              )}
              {(context.source === 'discovery' || context.source === 'trending' || context.source === 'home') && (
                <span className="capitalize">{context.source}</span>
              )}
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoBack}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-6 max-w-xl mx-auto">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
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
          ))}
        </div>
      </div>
    );
  }

  if (showFeedMode) {
    return (
      <div className="container py-6">
        {/* Header with close button */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b pb-3 mb-4 -mx-4 px-4">
          <div className="flex items-center justify-between max-w-xl mx-auto">
            <button
              onClick={handleGoBack}
              className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2 text-sm font-medium"
            >
              {context.source === 'hashtag' && context.hashtag && (
                <>
                  <Hash className="h-4 w-4" />
                  #{context.hashtag}
                </>
              )}
              {context.source === 'profile' && authorName && (
                <>
                  <User className="h-4 w-4" />
                  {authorName}'s videos
                </>
              )}
              {(context.source === 'discovery' || context.source === 'trending' || context.source === 'home') && (
                <span className="capitalize">{context.source}</span>
              )}
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoBack}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable video feed - progressive rendering */}
        <InfiniteScroll
          dataLength={visibleVideos.length}
          next={showMoreVideos}
          hasMore={hasMoreToShow}
          loader={
            <div className="h-16 flex items-center justify-center">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading more videos...</span>
              </div>
            </div>
          }
          className="space-y-6 max-w-xl mx-auto"
        >
          {visibleVideos.map((video, index) => {
            const isCurrentVideo = index === currentIndex;
            // Only render current video immediately, others wait until primary is loaded
            const shouldRender = isCurrentVideo || primaryVideoLoaded;

            return (
              <div
                key={video.id}
                ref={isCurrentVideo ? initialVideoRef : undefined}
                className="scroll-mt-20"
              >
                {shouldRender ? (
                  <VideoCardWithMetrics
                    video={video}
                    userInteractions={batchedInteractions.get(video.id)}
                  />
                ) : (
                  // Placeholder skeleton while waiting for primary video to load
                  <Card className="overflow-hidden">
                    <div className="flex items-center gap-3 p-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <Skeleton className="aspect-square w-full" />
                  </Card>
                )}
              </div>
            );
          })}
        </InfiniteScroll>
      </div>
    );
  }

  // Single video mode: show just the current video with navigation
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
          <VideoCardWithMetrics
            video={currentVideo}
            userInteractions={batchedInteractions.get(currentVideo.id)}
          />
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