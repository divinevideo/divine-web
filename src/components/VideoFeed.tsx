// ABOUTME: Video feed component for displaying scrollable lists of videos with infinite scroll
// ABOUTME: Uses video provider hook with automatic Funnelcake/WebSocket selection

import { useEffect, useMemo, useRef, useState } from 'react';
import { performanceMonitor } from '@/lib/performanceMonitoring';
import { Video } from 'lucide-react';
import { VideoCardWithMetrics } from '@/components/VideoCardWithMetrics';
import { VideoGrid } from '@/components/VideoGrid';
import { AddToListDialog } from '@/components/AddToListDialog';
import { useVideoProvider } from '@/hooks/useVideoProvider';
import { useBatchedAuthors } from '@/hooks/useBatchedAuthors';
import { useContentModeration } from '@/hooks/useModeration';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import InfiniteScroll from 'react-infinite-scroll-component';
import type { ParsedVideoData } from '@/types/video';
import { debugLog, debugWarn } from '@/lib/debug';
import type { SortMode } from '@/types/nostr';
import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { useFullscreenFeed } from '@/contexts/FullscreenFeedContext';

type ViewMode = 'feed' | 'grid';

interface VideoFeedProps {
  feedType?: 'discovery' | 'home' | 'trending' | 'hashtag' | 'profile' | 'recent' | 'classics';
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
}: VideoFeedProps) {
  const [showCommentsForVideo, setShowCommentsForVideo] = useState<string | null>(null);
  const [showListDialog, setShowListDialog] = useState<{ videoId: string; videoPubkey: string } | null>(null);
  const mountTimeRef = useRef<number | null>(null);

  const { checkContent } = useContentModeration();
  const navigate = useNavigate();
  const { setVideosForFullscreen, enterFullscreen, updateVideos } = useFullscreenFeed();

  // Use video provider hook - automatically selects Funnelcake or WebSocket
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    error,
    refetch,
    dataSource,
  } = useVideoProvider({
    feedType,
    hashtag,
    pubkey,
    pageSize: limit,
    sortMode,
  });

  // Log data source for debugging
  useEffect(() => {
    debugLog(`[VideoFeed] Using ${dataSource} for ${feedType} feed`);
  }, [dataSource, feedType]);

  // Flatten all pages into single array, deduplicating by video ID
  const allVideos = useMemo(() => {
    const videos = data?.pages.flatMap(page => page.videos) ?? [];
    const seen = new Set<string>();
    return videos.filter(video => {
      if (seen.has(video.id)) return false;
      seen.add(video.id);
      return true;
    });
  }, [data]);

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

  // Check if we have videos but they're all filtered (before early return)
  const allFiltered = allVideos && allVideos.length > 0 && (!filteredVideos || filteredVideos.length === 0);

  // Redirect empty home feed to discovery (must be before ALL early returns)
  useEffect(() => {
    if (!isLoading && feedType === 'home' && !allFiltered && (!filteredVideos || filteredVideos.length === 0)) {
      navigate('/discovery/');
    }
  }, [isLoading, feedType, allFiltered, navigate, filteredVideos]);

  // Register videos for fullscreen mode
  useEffect(() => {
    if (filteredVideos.length > 0) {
      setVideosForFullscreen(filteredVideos, fetchNextPage, hasNextPage ?? false);
    }
  }, [filteredVideos, setVideosForFullscreen, fetchNextPage, hasNextPage]);

  // Update videos in fullscreen when more are loaded
  useEffect(() => {
    if (filteredVideos.length > 0) {
      updateVideos(filteredVideos);
    }
  }, [filteredVideos, updateVideos]);

  // Stable callbacks for comment handling - MUST be before any early returns
  // to ensure hooks are called in the same order on every render
  const handleOpenComments = useCallback((video: ParsedVideoData) => {
    setShowCommentsForVideo(video.id);
  }, []);

  const handleCloseComments = useCallback(() => {
    setShowCommentsForVideo(null);
  }, []);

  // Enter fullscreen at a specific video index
  const handleEnterFullscreen = useCallback((index: number) => {
    enterFullscreen(filteredVideos, index);
  }, [filteredVideos, enterFullscreen]);

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
              {/* Show reclining Divine image for discovery/trending/classics feeds when no videos */}
              {(feedType === 'discovery' || feedType === 'trending' || feedType === 'classics') && !allFiltered ? (
                <>
                  <div className="mx-auto -mx-8 -mt-16">
                    <img
                      src="/divine_reclining.avif"
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
        <div className="grid gap-6">
          {filteredVideos.map((video, index) => (
            <VideoCardWithMetrics
              key={video.id}
              video={video}
              index={index}
              mode={mode}
              showComments={showCommentsForVideo === video.id}
              onOpenComments={() => handleOpenComments(video)}
              onCloseComments={handleCloseComments}
              onEnterFullscreen={() => handleEnterFullscreen(index)}
              navigationContext={{
                source: feedType,
                hashtag,
                pubkey,
              }}
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
