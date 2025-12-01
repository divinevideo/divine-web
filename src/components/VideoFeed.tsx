// ABOUTME: Video feed component for displaying scrollable lists of videos with infinite scroll
// ABOUTME: Uses optimized useInfiniteVideos hook with NIP-50 search and cursor pagination

import { useEffect, useMemo, useRef, useState } from 'react';
import { performanceMonitor } from '@/lib/performanceMonitoring';
import { Video } from 'lucide-react';
import { VideoCard } from '@/components/VideoCard';
import { VideoGrid } from '@/components/VideoGrid';
import { AddToListDialog } from '@/components/AddToListDialog';
import { useInfiniteVideos } from '@/hooks/useInfiniteVideos';
import { useBatchedAuthors } from '@/hooks/useBatchedAuthors';
import { useDeferredVideoMetrics } from '@/hooks/useDeferredVideoMetrics';
import { useOptimisticLike } from '@/hooks/useOptimisticLike';
import { useOptimisticRepost } from '@/hooks/useOptimisticRepost';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useContentModeration } from '@/hooks/useModeration';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/useToast';
import { useLoginDialog } from '@/contexts/LoginDialogContext';
import { Loader2 } from 'lucide-react';
import InfiniteScroll from 'react-infinite-scroll-component';
import type { ParsedVideoData } from '@/types/video';
import { debugLog, debugWarn } from '@/lib/debug';
import type { SortMode } from '@/types/nostr';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';
import { useNavigate } from 'react-router-dom';

type ViewMode = 'feed' | 'grid';

interface VideoFeedProps {
  feedType?: 'discovery' | 'home' | 'trending' | 'hashtag' | 'profile' | 'recent';
  hashtag?: string;
  pubkey?: string;
  limit?: number;
  sortMode?: SortMode; // NIP-50 sort mode (hot, top, rising, controversial)
  viewMode?: ViewMode; // Display mode: feed (full cards) or grid (thumbnails)
  className?: string;
  verifiedOnly?: boolean; // Filter to show only ProofMode verified videos
  mode?: 'auto-play' | 'thumbnail'; // Display mode for video cards
  'data-testid'?: string;
  'data-hashtag-testid'?: string;
  'data-profile-testid'?: string;
  autoScrollTimeout?: number;
  autoScrollAlignment?: 'center' | 'bottom'
}

export function VideoFeed({
  feedType = 'discovery',
  hashtag,
  pubkey,
  limit = 20, // Page size for infinite scroll
  sortMode,
  viewMode = 'feed',
  className,
  verifiedOnly = false,
  mode = 'auto-play',
  'data-testid': testId,
  'data-hashtag-testid': hashtagTestId,
  'data-profile-testid': profileTestId,
  autoScrollTimeout = 2000,
  autoScrollAlignment = 'center',
}: VideoFeedProps) {
  const [showCommentsForVideo, setShowCommentsForVideo] = useState<string | null>(null);
  const [showListDialog, setShowListDialog] = useState<{ videoId: string; videoPubkey: string } | null>(null);
  const mountTimeRef = useRef<number | null>(null);

  const videoCardsListRef = useRef<HTMLDivElement | null>(null);
  const activeVideoIndexRef = useRef<number | null>(null);
  const autoScrollTimeoutIdRef = useRef<number | null>(null);

  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { toggleLike } = useOptimisticLike();
  const { toggleRepost } = useOptimisticRepost();
  const { checkContent } = useContentModeration();
  const { openLoginDialog } = useLoginDialog();
  const navigate = useNavigate();

  const { activeVideoId, registerVideo, unregisterVideo, updateVideoVisibility, globalMuted, setGlobalMuted } = useVideoPlayback();

  // Use new infinite scroll hook with NIP-50 support
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    error,
    refetch
  } = useInfiniteVideos({
    feedType,
    hashtag,
    pubkey,
    pageSize: limit,
    sortMode,
  });

  // Flatten all pages into single array
  const allVideos = useMemo(() =>
    data?.pages.flatMap(page => page.videos) ?? [],
    [data]
  );

  // Filter videos based on mute list and verification status
  const filteredVideos = useMemo(() => {
    if (!allVideos || allVideos.length === 0) return [];

    return allVideos.filter(video => {
      // Check moderation filters
      const moderationResult = checkContent({
        pubkey: video.pubkey,
        eventId: video.id,
        hashtags: video.hashtags,
        text: video.content
      });

      // Filter out muted content
      if (moderationResult.shouldFilter) {
        return false;
      }

      // Filter for verified-only if enabled
      if (verifiedOnly) {
        return video.proofMode &&
               (video.proofMode.level === 'verified_mobile' ||
                video.proofMode.level === 'verified_web');
      }

      return true;
    });
  }, [allVideos, checkContent, verifiedOnly]);

  // Track perceived first-render time for the Recent feed
  useEffect(() => {
    if (feedType === 'recent') {
      if (mountTimeRef.current === null) {
        mountTimeRef.current = performance.now();
      }
      if (!isLoading && filteredVideos.length > 0 && mountTimeRef.current !== null) {
        const duration = performance.now() - mountTimeRef.current;
        performanceMonitor.recordMetric('recent_feed_first_render', duration, {
          videos: filteredVideos.length,
        });
        console.log(`[Performance] Recent feed first render in ${duration.toFixed(0)}ms (${filteredVideos.length} videos)`);
        // Only measure once per mount
        mountTimeRef.current = null;
      }
    }
  }, [feedType, isLoading, filteredVideos.length]);

  // Collect all unique pubkeys for batched author fetching
  const authorPubkeys = useMemo(() => {
    if (!filteredVideos || filteredVideos.length === 0) return [];
    const pubkeys = new Set<string>();
    filteredVideos.forEach(video => {
      pubkeys.add(video.pubkey);
      // Add all reposters' pubkeys
      if (video.reposts) {
        video.reposts.forEach(repost => pubkeys.add(repost.reposterPubkey));
      }
    });
    return Array.from(pubkeys);
  }, [filteredVideos]);

  // Prefetch all authors in a single query
  useBatchedAuthors(authorPubkeys);

  // Auto-navigate to discovery if home feed is empty
  useEffect(() => {
    // Only navigate if we have empty filtered videos but we're done loading
    const noFilteredVideos = !filteredVideos || filteredVideos.length === 0;
    const allFiltered = allVideos && allVideos.length > 0 && filteredVideos.length === 0;
    if (!isLoading && feedType === 'home' && noFilteredVideos && !allFiltered) {
      navigate('/discovery/');
    }
  }, [isLoading, feedType, filteredVideos, allVideos, navigate]);

  // Log video data when it changes
  useEffect(() => {
    const filtered = filteredVideos.length;
    const total = allVideos.length;
    debugLog(`[VideoFeed] Feed type: ${feedType}, Videos: ${filtered} shown / ${total} total (${total - filtered} filtered)`);
    if (filteredVideos.length > 0) {
      debugLog('[VideoFeed] First few videos:', filteredVideos.slice(0, 3).map(v => ({
        id: v.id,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        hasUrl: !!v.videoUrl
      })));

      // Check if any videos are missing URLs
      const missingUrls = filteredVideos.filter(v => !v.videoUrl);
      if (missingUrls.length > 0) {
        debugWarn(`[VideoFeed] ${missingUrls.length} videos missing URLs`);
      }
    }
  }, [filteredVideos, allVideos, feedType]);

  // Register the auto-scroll timeout.
  useEffect(() => {
    if (autoScrollTimeout !== undefined) {
      const newActiveVideoIndex = filteredVideos.findIndex(v => v.id === activeVideoId);
      if (newActiveVideoIndex !== activeVideoIndexRef.current) {
        autoScrollTimeoutIdRef.current = window.setTimeout(() => scrollToVideoCard(newActiveVideoIndex), autoScrollTimeout);

        activeVideoIndexRef.current = newActiveVideoIndex;
      }
    }

    return () => {
      if (autoScrollTimeoutIdRef.current) window.clearTimeout(autoScrollTimeoutIdRef.current);
    }
  }, [activeVideoId]);

  
  const scrollToVideoCard = (index: number) => {
    if (videoCardsListRef.current) {
      const card = videoCardsListRef.current.children[index] as HTMLDivElement;
      let scrollPosition: number | undefined;
      if (autoScrollAlignment === 'center')
        scrollPosition = (card.offsetTop - (window.innerHeight / 2)) + (card.offsetHeight / 2);
      else if (autoScrollAlignment === 'bottom')
        scrollPosition = card.offsetTop + card.offsetHeight - window.innerHeight;

      window.scrollTo({
        top: scrollPosition,
        behavior: 'smooth',
      });
    }
  };

  // Loading state (initial load only)
  if (isLoading && !data) {
    return (
      <div
        className={`feed-root ${className || ''}`}
        data-testid={testId}
        data-hashtag-testid={hashtagTestId}
        data-profile-testid={profileTestId}
      >
        <div className="grid gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="overflow-hidden" data-testid="video-skeleton">
              <div className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-full bg-muted/50 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-muted/50 rounded animate-pulse" />
                </div>
              </div>
              <div className="aspect-square w-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
                  <div className="absolute inset-0 border-4 border-transparent border-t-primary rounded-full animate-spin" />
                </div>
              </div>
              <div className="p-4 space-y-2">
                <div className="h-4 w-full bg-muted/50 rounded animate-pulse" />
                <div className="h-4 w-4/5 bg-muted/50 rounded animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`feed-root ${className || ''}`}
        data-testid={testId}
        data-hashtag-testid={hashtagTestId}
        data-profile-testid={profileTestId}
      >
        <Card className="border-destructive">
          <CardContent className="py-12 text-center">
            <p className="text-destructive mb-4">Failed to load videos</p>
            <button
              onClick={() => refetch()}
              className="text-primary hover:underline"
            >
              Try again
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state (check filteredVideos instead of allVideos)
  if (!filteredVideos || filteredVideos.length === 0) {
    // Check if we have videos but they're all filtered
    const allFiltered = allVideos && allVideos.length > 0 && filteredVideos.length === 0;

    return (
      <div
        className={`feed-root ${className || ''}`}
        data-testid={testId}
        data-hashtag-testid={hashtagTestId}
        data-profile-testid={profileTestId}
      >
        <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
          <CardContent className="py-16 px-8 text-center">
            <div className="max-w-md mx-auto space-y-6">
              {/* Show reclining Divine image for discovery/trending feeds when no videos */}
              {(feedType === 'discovery' || feedType === 'trending') && !allFiltered ? (
                <>
                  <div className="mx-auto -mx-8 -mt-16">
                    <img
                      src="/divine_reclining.jpg"
                      alt="Divine reclining"
                      className="w-full rounded-t-lg shadow-lg"
                    />
                  </div>
                  <div className="space-y-2 mt-6">
                    <p className="text-lg font-medium text-foreground">
                      Divine needs a rest
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Check back soon for new videos
                    </p>
                    <p className="text-xs text-muted-foreground/60 italic mt-4">
                      Photo by Marcus Leatherdale
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Video className="h-8 w-8 text-primary/60" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-foreground">
                      {allFiltered
                        ? "All videos filtered"
                        : feedType === 'home'
                        ? "Your feed is empty"
                        : feedType === 'hashtag'
                        ? `No videos with #${hashtag}`
                        : feedType === 'profile'
                        ? "No videos yet"
                        : feedType === 'recent'
                        ? "No recent videos"
                        : "No videos found"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {allFiltered
                        ? "All videos from this feed match your mute filters. Adjust your moderation settings to see content."
                        : feedType === 'home'
                        ? "Follow some creators to see their videos here!"
                        : feedType === 'hashtag'
                        ? "Be the first to post with this hashtag!"
                        : feedType === 'profile'
                        ? "Check back later for new content"
                        : "Check back soon for new videos"}
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleOpenComments = (video: ParsedVideoData) => {
    setShowCommentsForVideo(video.id);
  };

  const handleCloseComments = () => {
    setShowCommentsForVideo(null);
  };

  // Note: handleAddToList is not currently used as VideoListBadges handles its own dialog
  // const handleAddToList = (video: ParsedVideoData) => {
  //   if (!user) {
  //     toast({
  //       title: 'Login Required',
  //       description: 'Please log in to add videos to lists',
  //       variant: 'destructive',
  //     });
  //     return;
  //   }

  //   if (!video.vineId) {
  //     toast({
  //       title: 'Error',
  //       description: 'Cannot add this video to a list',
  //       variant: 'destructive',
  //     });
  //     return;
  //   }

  //   setShowListDialog({ videoId: video.vineId, videoPubkey: video.pubkey });
  // };

  // Helper component to provide social metrics data for each video
  function VideoCardWithMetrics({ video, index }: { video: ParsedVideoData; index: number }) {
    // Use deferred loading: render video immediately, load metrics after a short delay
    // First 3 videos load immediately, rest have a staggered delay for progressive enhancement
    const delay = index < 3 ? 0 : Math.min(index * 50, 500);
    const { socialMetrics, userInteractions, isLoading } = useDeferredVideoMetrics({
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
        key={video.id}
        video={video}
        mode={mode}
        onLike={handleVideoLike}
        onRepost={handleVideoRepost}
        onOpenComments={() => handleOpenComments(video)}
        onCloseComments={handleCloseComments}
        isLiked={userInteractions.data?.hasLiked || false}
        isReposted={userInteractions.data?.hasReposted || false}
        likeCount={video.likeCount ?? socialMetrics.data?.likeCount ?? 0}
        repostCount={video.repostCount ?? socialMetrics.data?.repostCount ?? 0}
        commentCount={video.commentCount ?? socialMetrics.data?.commentCount ?? 0}
        viewCount={socialMetrics.data?.viewCount || video.loopCount}
        showComments={showCommentsForVideo === video.id}
        navigationContext={{
          source: feedType,
          hashtag,
          pubkey,
        }}
        videoIndex={index}
        data-testid="video-card"
      />
    );
  }

  // Only create VideoCard components for videos in the visible range
  // Use infinite scroll component for smooth pagination
  // Grid mode uses VideoGrid component for thumbnail display
  if (viewMode === 'grid') {
    return (
      <div
        className={`feed-root ${className || ''}`}
        data-testid={testId}
        data-hashtag-testid={hashtagTestId}
        data-profile-testid={profileTestId}
      >
        <InfiniteScroll
          dataLength={filteredVideos.length}
          next={fetchNextPage}
          hasMore={hasNextPage ?? false}
          loader={
            <div className="h-16 flex items-center justify-center col-span-full">
              <div className="flex items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading more videos...</span>
              </div>
            </div>
          }
          endMessage={
            filteredVideos.length > 10 ? (
              <div className="py-8 text-center text-sm text-muted-foreground col-span-full">
                <p>You've reached the end</p>
              </div>
            ) : null
          }
        >
          <VideoGrid
            videos={filteredVideos}
            loading={false}
            navigationContext={{
              source: feedType,
              hashtag,
              pubkey,
            }}
          />
        </InfiniteScroll>

        {/* Add to List Dialog */}
        {showListDialog && (
          <AddToListDialog
            videoId={showListDialog.videoId}
            videoPubkey={showListDialog.videoPubkey}
            open={true}
            onClose={() => setShowListDialog(null)}
          />
        )}
      </div>
    );
  }

  // Feed mode uses full VideoCard components
  return (
    <div
      className={className}
      data-testid={testId}
      data-hashtag-testid={hashtagTestId}
      data-profile-testid={profileTestId}
    >
      <InfiniteScroll
        dataLength={filteredVideos.length}
        next={fetchNextPage}
        hasMore={hasNextPage ?? false}
        loader={
          <div className="h-16 flex items-center justify-center">
            <div className="flex items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading more videos...</span>
            </div>
          </div>
        }
        endMessage={
          filteredVideos.length > 10 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <p>You've reached the end</p>
            </div>
          ) : null
        }
      >
        <div className="grid gap-6" ref={videoCardsListRef}>
          {filteredVideos.map((video, index) => (
            <VideoCardWithMetrics
              key={video.id}
              video={video}
              index={index}
            />
          ))}
        </div>
      </InfiniteScroll>

      {/* Add to List Dialog */}
      {showListDialog && (
        <AddToListDialog
          videoId={showListDialog.videoId}
          videoPubkey={showListDialog.videoPubkey}
          open={true}
          onClose={() => setShowListDialog(null)}
        />
      )}
    </div>
  );
}
