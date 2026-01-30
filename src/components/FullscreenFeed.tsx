// ABOUTME: Fullscreen TikTok-style vertical swipe video feed
// ABOUTME: Uses CSS scroll-snap for native momentum scrolling between videos

import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FullscreenVideoItem } from '@/components/FullscreenVideoItem';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';
import { useDeferredVideoMetrics } from '@/hooks/useDeferredVideoMetrics';
import { useOptimisticLike } from '@/hooks/useOptimisticLike';
import { useOptimisticRepost } from '@/hooks/useOptimisticRepost';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginDialog } from '@/contexts/LoginDialogContext';
import { useToast } from '@/hooks/useToast';
import { debugLog } from '@/lib/debug';
import type { ParsedVideoData } from '@/types/video';

interface FullscreenFeedProps {
  videos: ParsedVideoData[];
  startIndex: number;
  onClose: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

// Wrapper component to provide metrics for each video
function FullscreenVideoWithMetrics({
  video,
  index: _index,
  isActive,
  onBack,
}: {
  video: ParsedVideoData;
  index: number;
  isActive: boolean;
  onBack: () => void;
}) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { toggleLike } = useOptimisticLike();
  const { toggleRepost } = useOptimisticRepost();
  const { openLoginDialog } = useLoginDialog();

  // Load metrics for this video
  const { socialMetrics, userInteractions } = useDeferredVideoMetrics({
    videoId: video.id,
    videoPubkey: video.pubkey,
    vineId: video.vineId,
    userPubkey: user?.pubkey,
    delay: 0,
    immediate: true,
  });

  const handleLike = async () => {
    if (!user) {
      openLoginDialog();
      return;
    }

    debugLog('Fullscreen: Toggle like for video:', video.id);
    await toggleLike({
      videoId: video.id,
      videoPubkey: video.pubkey,
      vineId: video.vineId,
      userPubkey: user.pubkey,
      isCurrentlyLiked: userInteractions.data?.hasLiked || false,
      currentLikeEventId: userInteractions.data?.likeEventId || null,
    });
  };

  const handleRepost = async () => {
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

    debugLog('Fullscreen: Toggle repost for video:', video.id);
    await toggleRepost({
      videoId: video.id,
      videoPubkey: video.pubkey,
      vineId: video.vineId,
      userPubkey: user.pubkey,
      isCurrentlyReposted: userInteractions.data?.hasReposted || false,
      currentRepostEventId: userInteractions.data?.repostEventId || null,
    });
  };

  const handleShare = async () => {
    const videoUrl = `${window.location.origin}/video/${video.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ url: videoUrl });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast({
            title: 'Error',
            description: 'Failed to share video',
            variant: 'destructive',
          });
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(videoUrl);
        toast({
          title: 'Link copied!',
          description: 'Video link has been copied to clipboard',
        });
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to copy link to clipboard',
          variant: 'destructive',
        });
      }
    }
  };

  const handleDownload = async () => {
    if (!video.videoUrl) {
      toast({
        title: 'Error',
        description: 'No video URL available',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(video.videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${video.title || video.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Download started',
        description: 'Your video download has begun',
      });
    } catch {
      window.open(video.videoUrl, '_blank');
    }
  };

  return (
    <FullscreenVideoItem
      video={video}
      isActive={isActive}
      onBack={onBack}
      onLike={handleLike}
      onRepost={handleRepost}
      onShare={handleShare}
      onDownload={handleDownload}
      isLiked={userInteractions.data?.hasLiked || false}
      isReposted={userInteractions.data?.hasReposted || false}
      likeCount={(video.likeCount ?? 0) + (socialMetrics.data?.likeCount ?? 0)}
      repostCount={(video.repostCount ?? 0) + (socialMetrics.data?.repostCount ?? 0)}
      commentCount={(video.commentCount ?? 0) + (socialMetrics.data?.commentCount ?? 0)}
      viewCount={(socialMetrics.data?.viewCount ?? 0) + (video.loopCount ?? 0)}
    />
  );
}

export function FullscreenFeed({
  videos,
  startIndex,
  onClose,
  onLoadMore,
  hasMore,
}: FullscreenFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [mounted, setMounted] = useState(false);
  const { setGlobalMuted, globalMuted } = useVideoPlayback();
  const previousMutedState = useRef(globalMuted);

  // Unmute when entering fullscreen, restore on exit
  useEffect(() => {
    // Store previous state and unmute
    previousMutedState.current = globalMuted;
    setGlobalMuted(false);

    return () => {
      // Restore previous mute state when exiting fullscreen
      setGlobalMuted(previousMutedState.current);
    };
  }, []); // Only run on mount/unmount

  // Mount animation
  useEffect(() => {
    setMounted(true);
    // Lock body scroll when fullscreen is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Scroll to start index on mount
  useEffect(() => {
    if (containerRef.current && mounted) {
      const targetElement = containerRef.current.children[startIndex] as HTMLElement;
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'instant' });
      }
    }
  }, [startIndex, mounted]);

  // Handle scroll to detect current video
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;

    // Calculate which video is most visible
    const newIndex = Math.round(scrollTop / viewportHeight);

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < videos.length) {
      setCurrentIndex(newIndex);

      // Load more videos when near the end
      if (hasMore && onLoadMore && newIndex >= videos.length - 3) {
        onLoadMore();
      }
    }
  }, [currentIndex, videos.length, hasMore, onLoadMore]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        // Next video
        if (currentIndex < videos.length - 1) {
          const targetElement = containerRef.current?.children[currentIndex + 1] as HTMLElement;
          targetElement?.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        // Previous video
        if (currentIndex > 0) {
          const targetElement = containerRef.current?.children[currentIndex - 1] as HTMLElement;
          targetElement?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, videos.length, onClose]);

  // Portal content
  const content = (
    <div
      className={`fixed inset-0 z-[100] bg-black transition-opacity duration-200 ${
        mounted ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        ref={containerRef}
        className="h-screen w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        onScroll={handleScroll}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {videos.map((video, index) => (
          <FullscreenVideoWithMetrics
            key={video.id}
            video={video}
            index={index}
            isActive={index === currentIndex}
            onBack={onClose}
          />
        ))}
      </div>
    </div>
  );

  // Render as portal to escape any parent stacking contexts
  return createPortal(content, document.body);
}
