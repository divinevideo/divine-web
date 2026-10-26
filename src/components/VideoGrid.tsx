// ABOUTME: Video grid component displaying videos in responsive grid layout
// ABOUTME: Shows video thumbnails with play overlays and metadata on hover

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Repeat } from '@phosphor-icons/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AgeRestrictedMediaPlaceholder } from '@/components/AgeRestrictedMediaPlaceholder';
import { AgeRestrictedPreferenceCard } from '@/components/AgeRestrictedPreferenceCard';
import { Button } from '@/components/ui/button';
import { SmartLink } from '@/components/SmartLink';
import { useLoginDialog } from '@/contexts/LoginDialogContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { checkMediaAuth, useAdultVerification } from '@/hooks/useAdultVerification';
import { useAgeConfirmationFeedback } from '@/hooks/useAgeConfirmationFeedback';
import { useAgeRestrictedPreference } from '@/hooks/useAgeRestrictedPreference';
import { useAuthenticatedMediaUrl } from '@/hooks/useAuthenticatedMediaUrl';
import { cn } from '@/lib/utils';
import type { ParsedVideoData } from '@/types/video';
import { buildVideoNavigationUrl, type VideoNavigationContext } from '@/hooks/useVideoNavigation';
import { getVisiblePlaybackCount } from '@/lib/playbackCount';

interface VideoGridProps {
  videos: ParsedVideoData[];
  loading?: boolean;
  className?: string;
  navigationContext?: VideoNavigationContext;
  navigationIndices?: ReadonlyMap<string, number>;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

interface VideoGridMediaProps {
  video: ParsedVideoData;
  thumbnailFailed: boolean;
  onThumbnailError: (videoId: string) => void;
  videoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>;
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

function VideoGridMedia({
  video,
  thumbnailFailed,
  onThumbnailError,
  videoRefs,
}: VideoGridMediaProps) {
  const shouldShowVideo = !video.thumbnailUrl || thumbnailFailed;
  const baseThumbnailUrl = video.thumbnailUrl || video.videoUrl;
  const { mediaUrl: authenticatedMediaUrl, isLoading } = useAuthenticatedMediaUrl(baseThumbnailUrl, {
    enabled: true,
    ageRestricted: !!video.ageRestricted,
  });

  if (isLoading) {
    return (
      <div
        className="w-full h-full bg-muted flex items-center justify-center"
        data-testid={`video-placeholder-${video.id}`}
      >
        <Play className="w-12 h-12 text-muted-foreground" />
      </div>
    );
  }

  if (shouldShowVideo && authenticatedMediaUrl) {
    return (
      <video
        ref={(el) => {
          if (el) {
            videoRefs.current.set(video.id, el);
          } else {
            videoRefs.current.delete(video.id);
          }
        }}
        className="w-full h-full object-cover"
        src={authenticatedMediaUrl}
        muted
        loop
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        data-testid={`video-player-${video.id}`}
        onError={() => onThumbnailError(video.id)}
      />
    );
  }

  if (authenticatedMediaUrl) {
    const isVideoThumbnail = (video.thumbnailUrl === video.videoUrl) ||
      !!video.thumbnailUrl?.match(/\.(mp4|webm|mov|m3u8|mpd|avi|mkv|ogv|ogg)($|\?|#)/i) ||
      !!video.thumbnailUrl?.includes('/manifest/');

    if (isVideoThumbnail) {
      return (
        <video
          className="w-full h-full object-cover"
          src={`${authenticatedMediaUrl}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          data-testid={`video-thumbnail-${video.id}`}
          onError={() => onThumbnailError(video.id)}
        />
      );
    }

    return (
      <img
        className="w-full h-full object-cover"
        src={authenticatedMediaUrl}
        alt={video.content || 'Video thumbnail'}
        loading="lazy"
        crossOrigin="anonymous"
        data-testid={`video-thumbnail-${video.id}`}
        onError={() => onThumbnailError(video.id)}
      />
    );
  }

  return (
    <div
      className="w-full h-full bg-muted flex items-center justify-center"
      data-testid={`video-placeholder-${video.id}`}
    >
      <Play className="w-12 h-12 text-muted-foreground" />
    </div>
  );
}

export function VideoGrid({ videos, loading = false, className, navigationContext, navigationIndices, onLoadMore, isLoadingMore }: VideoGridProps) {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { isVerified: isAdultVerified, confirmAdult, isLoading: isCheckingAge, isProtectedMinor } = useAdultVerification();
  const { confirmFor, failedFor } = useAgeConfirmationFeedback(confirmAdult, `${user?.pubkey ?? ''}:${isCheckingAge}:${isProtectedMinor}`);
  const { markAgeRestricted, hideAgeRestricted, setHideAgeRestricted, shouldHideVideo } = useAgeRestrictedPreference();
  const { openLoginDialog } = useLoginDialog();
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [failedThumbnails, setFailedThumbnails] = useState<Set<string>>(new Set());
  const [discoveredAgeRestrictedVideos, setDiscoveredAgeRestrictedVideos] = useState<Set<string>>(new Set());
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const buildVideoUrl = (videoId: string, index: number) => {
    return navigationContext
      ? buildVideoNavigationUrl(videoId, navigationContext, navigationIndices?.get(videoId) ?? index)
      : `/video/${videoId}`;
  };

  // Keyboard activation for age-gated tiles only — unrestricted tiles are
  // real links, so Enter activation comes for free from the anchor element.
  const handleGatedKeyDown = (event: React.KeyboardEvent, videoId: string) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleAgeGateAction(videoId);
    }
  };

  const handleThumbnailError = async (video: ParsedVideoData) => {
    const urlToCheck = video.thumbnailUrl || video.videoUrl;

    if (urlToCheck) {
      const { authorized, status } = await checkMediaAuth(urlToCheck);
      if (!authorized && (status === 401 || status === 403)) {
        markAgeRestricted(video);
        setDiscoveredAgeRestrictedVideos((prev) => new Set(prev).add(video.id));
        return;
      }
    }

    setFailedThumbnails((prev) => new Set(prev).add(video.id));
  };

  const handleAgeGateAction = (videoId: string) => {
    if (user) {
      if (isCheckingAge || isProtectedMinor) return;
      confirmFor(videoId);
      return;
    }

    openLoginDialog();
  };

  const handleMouseEnter = (videoId: string, isAgeGated: boolean) => {
    if (isAgeGated) return;
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

  const handleMouseLeave = (videoId: string, isAgeGated: boolean) => {
    if (isAgeGated) return;
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

  const visibleVideos = videos
    .map((video, index) => ({ video, index }))
    .filter(({ video }) => !shouldHideVideo(video));
  const pagingControl = onLoadMore ? (
    <Button type="button" variant="outline" disabled={isLoadingMore} aria-busy={isLoadingMore} onClick={onLoadMore}>
      {isLoadingMore ? t('profilePage.loadingMore') : t('uiPagination.goToNext')}
    </Button>
  ) : null;

  if (loading) {
    return (
      <div
        className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}
        data-testid="video-grid"
      >
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="overflow-hidden" data-testid="video-skeleton">
            <div className="aspect-square relative bg-black/80 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-brand-light-green border-t-brand-green rounded-full animate-spin" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (visibleVideos.length === 0) {
    if (videos.length > 0) {
      return (
        <div className={cn('col-span-full space-y-4', className)} data-testid="video-grid-empty">
          <AgeRestrictedPreferenceCard />
          {pagingControl}
        </div>
      );
    }
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
      {visibleVideos.map(({ video, index }) => {
        const isHovered = hoveredVideo === video.id;
        const thumbnailFailed = failedThumbnails.has(video.id);
        const isKnownAgeRestricted = video.ageRestricted === true || discoveredAgeRestrictedVideos.has(video.id);
        const gridVideo = isKnownAgeRestricted ? { ...video, ageRestricted: true } : video;
        const isAgeGated = isKnownAgeRestricted && (!user || !isAdultVerified);
        const visiblePlaybackCount = getVisiblePlaybackCount({
          isVineMigrated: video.isVineMigrated,
          loopCount: video.loopCount,
          viewStartCount: video.divineViewCount,
        });

        const tile = (
            <div className="aspect-square relative bg-muted" data-thumbnail-container="true">
              {/* Video Thumbnail or Actual Video */}
              {isAgeGated ? (
                <AgeRestrictedMediaPlaceholder
                  actionLabel={user && isCheckingAge ? t('ageVerificationOverlay.checkingAgeStatus') : user ? t('videoCard.verifyAgeToView') : t('videoCard.logInToView')}
                  actionDisabled={!!user && (isCheckingAge || isProtectedMinor)}
                  actionMessage={user && isProtectedMinor ? t('ageVerificationOverlay.unavailableForAccount') : failedFor(video.id) ? t('ageVerificationOverlay.confirmationFailed') : undefined}
                  actionMessageRole={failedFor(video.id) ? 'alert' : undefined}
                  onAction={() => handleAgeGateAction(video.id)}
                  onHide={() => setHideAgeRestricted(!hideAgeRestricted)}
                  hideLabel={hideAgeRestricted ? t('moderationSettings.showAgeRestrictedVideos') : undefined}
                  title={video.title || video.content}
                />
              ) : (
                <VideoGridMedia
                  video={gridVideo}
                  thumbnailFailed={thumbnailFailed}
                  onThumbnailError={() => void handleThumbnailError(gridVideo)}
                  videoRefs={videoRefs}
                />
              )}

              {/* Play Overlay */}
              {!isAgeGated && (
                <div
                  className="absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity group-hover:bg-black/40"
                  data-testid={`play-overlay-${video.id}`}
                >
                  <div className="bg-white/90 rounded-full p-3 transition-transform group-hover:scale-110">
                    <Play className="w-6 h-6 text-black fill-black" />
                  </div>
                </div>
              )}

              {/* Loop Count Badge */}
              {!isAgeGated && visiblePlaybackCount > 0 && (
                <div className="absolute bottom-2 right-2">
                  <Badge variant="secondary" className="text-xs bg-black/80 text-white">
                    <Repeat className="w-3 h-3 mr-1" />
                    {formatLoops(visiblePlaybackCount)}
                  </Badge>
                </div>
              )}

              {/* Metadata Overlay */}
              {!isAgeGated && isHovered && (video.content || video.hashtags.length > 0) && (
                <div
                  className="absolute inset-x-0 bottom-0 bg-brand-dark-green/85 p-4 text-brand-off-white"
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
        );

        return (
          <Card
            key={video.id}
            className="overflow-hidden cursor-pointer transition-transform hover:scale-105 group"
            data-testid="video-grid-item"
            onMouseEnter={() => handleMouseEnter(video.id, isAgeGated)}
            onMouseLeave={() => handleMouseLeave(video.id, isAgeGated)}
            data-video-id={video.id}
            {...(isAgeGated
              ? {
                  onClick: () => handleAgeGateAction(video.id),
                  onKeyDown: (event: React.KeyboardEvent) => handleGatedKeyDown(event, video.id),
                  tabIndex: 0,
                }
              : {})}
          >
            {isAgeGated ? (
              tile
            ) : (
              // Real link so middle-click / right-click → open in new tab work;
              // plain left-click stays SPA navigation via SmartLink.
              <SmartLink
                to={buildVideoUrl(video.id, index)}
                ownerPubkey={video.pubkey}
                className="block"
                aria-label={video.title || video.content || 'Open video'}
              >
                {tile}
              </SmartLink>
            )}
          </Card>
        );
      })}
      {pagingControl && <div className="col-span-full">{pagingControl}</div>}
    </div>
  );
}
