// ABOUTME: Video grid component displaying videos in responsive grid layout
// ABOUTME: Shows video thumbnails with play overlays and metadata on hover

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Repeat } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ParsedVideoData } from '@/types/video';
import { buildVideoNavigationUrl, type VideoNavigationContext } from '@/hooks/useVideoNavigation';

interface VideoGridProps {
  videos: ParsedVideoData[];
  loading?: boolean;
  className?: string;
  navigationContext?: VideoNavigationContext;
}

function formatLoops(loops?: number): string {
  if (!loops) return '0 loops';

  if (loops >= 1000000) {
    return `${(loops / 1000000).toFixed(1)}M loops`;
  }
  if (loops >= 1000) {
    return `${(loops / 1000).toFixed(1)}K loops`;
  }
  return `${loops} loops`;
}

function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function VideoGrid({ videos, loading = false, className, navigationContext }: VideoGridProps) {
  const navigate = useNavigate();
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [failedThumbnails, setFailedThumbnails] = useState<Set<string>>(new Set());
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const handleVideoClick = (videoId: string, index: number) => {
    const url = navigationContext
      ? buildVideoNavigationUrl(videoId, navigationContext, index)
      : `/video/${videoId}`;
    navigate(url);
  };

  const handleKeyDown = (event: React.KeyboardEvent, videoId: string, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleVideoClick(videoId, index);
    }
  };

  const handleThumbnailError = (videoId: string) => {
    setFailedThumbnails((prev) => new Set(prev).add(videoId));
  };

  const handleMouseEnter = (videoId: string) => {
    setHoveredVideo(videoId);
    // Auto-play video on hover if thumbnail failed
    if (failedThumbnails.has(videoId)) {
      const videoEl = videoRefs.current.get(videoId);
      if (videoEl) {
        videoEl.play().catch(() => {
          // Ignore play errors
        });
      }
    }
  };

  const handleMouseLeave = (videoId: string) => {
    setHoveredVideo(null);
    // Pause video when not hovering if thumbnail failed
    if (failedThumbnails.has(videoId)) {
      const videoEl = videoRefs.current.get(videoId);
      if (videoEl) {
        videoEl.pause();
        videoEl.currentTime = 0;
      }
    }
  };

  if (loading) {
    return (
      <div
        className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}
        data-testid="video-grid"
      >
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="overflow-hidden" data-testid="video-skeleton">
            <div className="aspect-square relative bg-black/80 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground/60 rounded-full animate-spin" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div
        className={cn("col-span-full", className)}
        data-testid="video-grid-empty"
      >
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-4">
              <p className="text-muted-foreground">
                No videos to display
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}
      data-testid="video-grid"
    >
      {videos.map((video, index) => {
        const isHovered = hoveredVideo === video.id;
        const thumbnailFailed = failedThumbnails.has(video.id);
        const shouldShowVideo = !video.thumbnailUrl || thumbnailFailed;

        return (
          <Card
            key={video.id}
            className="overflow-hidden cursor-pointer transition-transform hover:scale-105 group"
            data-testid="video-grid-item"
            onClick={() => handleVideoClick(video.id, index)}
            onKeyDown={(e) => handleKeyDown(e, video.id, index)}
            onMouseEnter={() => handleMouseEnter(video.id)}
            onMouseLeave={() => handleMouseLeave(video.id)}
            tabIndex={0}
            data-video-id={video.id}
          >
            <div className="aspect-square relative bg-muted" data-thumbnail-container="true">
              {/* Video Thumbnail or Actual Video */}
              {shouldShowVideo && video.videoUrl ? (
                <video
                  ref={(el) => {
                    if (el) {
                      videoRefs.current.set(video.id, el);
                    } else {
                      videoRefs.current.delete(video.id);
                    }
                  }}
                  className="w-full h-full object-cover"
                  src={video.videoUrl}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  crossOrigin="anonymous"
                  data-testid={`video-player-${video.id}`}
                  onError={() => handleThumbnailError(video.id)}
                />
              ) : video.thumbnailUrl ? (
                // Check if thumbnail URL is actually a video file
                video.thumbnailUrl === video.videoUrl ||
                video.thumbnailUrl.match(/\.(mp4|webm|mov|m3u8|mpd|avi|mkv|ogv|ogg)($|\?|#)/i) ||
                video.thumbnailUrl.includes('/manifest/') ? (
                  <video
                    className="w-full h-full object-cover"
                    src={`${video.thumbnailUrl}#t=0.1`}
                    muted
                    playsInline
                    preload="metadata"
                    crossOrigin="anonymous"
                    data-testid={`video-thumbnail-${video.id}`}
                    onError={() => handleThumbnailError(video.id)}
                  />
                ) : (
                  <img
                    className="w-full h-full object-cover"
                    src={video.thumbnailUrl}
                    alt={video.content || 'Video thumbnail'}
                    loading="lazy"
                    crossOrigin="anonymous"
                    data-testid={`video-thumbnail-${video.id}`}
                    onError={() => handleThumbnailError(video.id)}
                  />
                )
              ) : (
                <div
                  className="w-full h-full bg-muted flex items-center justify-center"
                  data-testid={`video-placeholder-${video.id}`}
                >
                  <Play className="w-12 h-12 text-muted-foreground" />
                </div>
              )}

              {/* Play Overlay */}
              <div
                className="absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity group-hover:bg-black/40"
                data-testid={`play-overlay-${video.id}`}
              >
                <div className="bg-white/90 rounded-full p-3 transition-transform group-hover:scale-110">
                  <Play className="w-6 h-6 text-black fill-black" />
                </div>
              </div>

              {/* Loop Count Badge */}
              {video.loopCount !== undefined && video.loopCount > 0 && (
                <div className="absolute bottom-2 right-2">
                  <Badge variant="secondary" className="text-xs bg-black/80 text-white">
                    <Repeat className="w-3 h-3 mr-1" />
                    {formatLoops(video.loopCount)}
                  </Badge>
                </div>
              )}

              {/* Metadata Overlay */}
              {isHovered && (video.content || video.hashtags.length > 0) && (
                <div
                  className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white"
                  data-testid={`metadata-overlay-${video.id}`}
                >
                  {video.content && video.content.trim() && (
                    <p className="text-sm font-medium mb-1">
                      {truncateText(video.content)}
                    </p>
                  )}
                  {video.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {video.hashtags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs text-blue-300">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}