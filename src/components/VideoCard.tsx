// ABOUTME: Video card component for displaying individual videos in feeds
// ABOUTME: Shows video player, metadata, author info, and social interactions

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Heart, Repeat2, MessageCircle, Share, Eye, MoreVertical, Flag, UserX, Trash2, Volume2, VolumeX, Code, Users, ListPlus, Download, Maximize2, Captions } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { VideoPlayer } from '@/components/VideoPlayer';
import { VideoCommentsModal } from '@/components/VideoCommentsModal';
import { VideoReactionsModal } from '@/components/VideoReactionsModal';
import { useVideoReactions } from '@/hooks/useVideoReactions';
import { ThumbnailPlayer } from '@/components/ThumbnailPlayer';
import { NoteContent } from '@/components/NoteContent';
import { ProofModeBadge } from '@/components/ProofModeBadge';
import { VineBadge } from '@/components/VineBadge';
import { AddToListDialog } from '@/components/AddToListDialog';
import { ReportContentDialog } from '@/components/ReportContentDialog';
import { DeleteVideoDialog } from '@/components/DeleteVideoDialog';
import { ViewSourceDialog } from '@/components/ViewSourceDialog';
import { useAuthor } from '@/hooks/useAuthor';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useMuteItem } from '@/hooks/useModeration';
import { useDeleteVideo, useCanDeleteVideo } from '@/hooks/useDeleteVideo';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';
import { useVideosInLists } from '@/hooks/useVideoLists';
import { enhanceAuthorData } from '@/lib/generateProfile';
import { formatDistanceToNow } from 'date-fns';
import type { ParsedVideoData } from '@/types/video';
import type { NostrMetadata } from '@nostrify/nostrify';
import { cn } from '@/lib/utils';
import { formatViewCount, formatCount } from '@/lib/formatUtils';
import { getSafeProfileImage } from '@/lib/imageUtils';
import type { ViewTrafficSource } from '@/hooks/useViewEventPublisher';
import type { VideoNavigationContext } from '@/hooks/useVideoNavigation';
import { useToast } from '@/hooks/useToast';
import { useShare } from '@/hooks/useShare';
import { getVideoShareData } from '@/lib/shareUtils';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { SmartLink } from '@/components/SmartLink';
import { MuteType } from '@/types/moderation';
import { getOptimalVideoUrl } from '@/lib/bandwidthTracker';
import { useBandwidthTier } from '@/hooks/useBandwidthTier';
import { useSubtitles } from '@/hooks/useSubtitles';

interface VideoCardProps {
  video: ParsedVideoData;
  className?: string;
  mode?: 'thumbnail' | 'auto-play';
  layout?: 'horizontal' | 'vertical'; // horizontal = Vine-style side-by-side, vertical = stacked
  onLike?: () => void;
  onRepost?: () => void;
  onOpenComments?: (video: ParsedVideoData) => void;
  onCloseComments?: () => void;
  onPlay?: () => void;
  onLoadedData?: () => void;
  onEnterFullscreen?: () => void;
  isLiked?: boolean;
  isReposted?: boolean;
  likeCount?: number;
  repostCount?: number;
  commentCount?: number;
  viewCount?: number;
  showComments?: boolean;
  // Navigation context for maintaining feed position
  navigationContext?: VideoNavigationContext;
  videoIndex?: number;
  trafficSource?: ViewTrafficSource;
}

export function VideoCard({
  video,
  className,
  mode = 'auto-play',
  layout,
  onLike,
  onRepost,
  onOpenComments,
  onCloseComments,
  onPlay,
  onLoadedData,
  onEnterFullscreen,
  isLiked = false,
  isReposted = false,
  likeCount = 0,
  repostCount = 0,
  commentCount = 0,
  viewCount = 0,
  showComments = false,
  navigationContext: _navigationContext,
  videoIndex: _videoIndex,
  trafficSource,
}: VideoCardProps) {
  const authorData = useAuthor(video.pubkey, {
    initialName: video.authorName,
    initialAvatar: video.authorAvatar,
  });
  // Subscribe to bandwidth tier changes - triggers re-render when tier changes
  // The tier itself is used internally by getOptimalVideoUrl
  const _bandwidthTier = useBandwidthTier();

  // Compute optimal HLS URL based on current bandwidth tier
  // This dynamically selects 480p/720p/adaptive based on observed load performance
  const optimalHlsUrl = getOptimalVideoUrl(video.videoUrl);
  // Use the video's hlsUrl if provided (e.g., already HLS), otherwise use computed optimal URL
  const effectiveHlsUrl = video.hlsUrl || (optimalHlsUrl !== video.videoUrl ? optimalHlsUrl : undefined);
  const { data: lists } = useVideosInLists(video.vineId ?? undefined);

  // NEW: Get reposter data from reposts array
  const hasReposts = video.reposts && video.reposts.length > 0;
  const latestRepost = hasReposts ? video.reposts[video.reposts.length - 1] : null;
  const reposterPubkey = latestRepost?.reposterPubkey;
  const reposterData = useAuthor(reposterPubkey || '');
  const shouldShowReposter = hasReposts && reposterPubkey;
  const [videoError, setVideoError] = useState(false);
  // Always start with video player visible in auto-play mode, but let VideoPlaybackContext control actual playback
  // The VideoPlayer component will only play when it's the activeVideoId (most visible)
  const [isPlaying, setIsPlaying] = useState(mode === 'auto-play');
  const [showAddToListDialog, setShowAddToListDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showReportUserDialog, setShowReportUserDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showViewSourceDialog, setShowViewSourceDialog] = useState(false);
  const [showReactionsModal, setShowReactionsModal] = useState<'likes' | 'reposts' | null>(null);
  // Calculate initial aspect ratio from video dimensions, or use sensible defaults
  // Classic Vine videos were ALWAYS 1:1 square — ignore any dim tag or transcoder dimensions
  const hasDeclaredDimensions = !!video.dimensions;
  // Vine shut down Jan 17, 2017 (unix 1484611200) — videos with originalVineTimestamp
  // before that date are almost certainly classic Vines even without origin/platform tags
  const isClassicVine = !!video.loopCount || video.isVineMigrated ||
    (video.originalVineTimestamp !== undefined && video.originalVineTimestamp < 1484611200);

  // Log once per video mount to trace aspect ratio decisions
  useMemo(() => {
    console.log(`[AspectRatio] video=${video.id?.slice(0, 8)} isClassicVine=${isClassicVine}`,
      `loopCount=${video.loopCount} isVineMigrated=${video.isVineMigrated}`,
      `dimensions=${video.dimensions} vineTimestamp=${video.originalVineTimestamp}`);
  }, [video.id, isClassicVine, video.loopCount, video.isVineMigrated, video.dimensions, video.originalVineTimestamp]);

  const getInitialAspectRatio = (): number => {
    // Classic Vines are always square, regardless of what dim tag says
    if (isClassicVine) return 1;
    // Try to parse dimensions from video data (format: "WIDTHxHEIGHT", e.g., "1080x1920")
    if (video.dimensions) {
      const [width, height] = video.dimensions.split('x').map(Number);
      if (width && height && !isNaN(width) && !isNaN(height)) {
        return width / height;
      }
    }
    // Fallback: most modern videos are 9:16 vertical
    return 9 / 16;
  };
  const initialAspectRatio = getInitialAspectRatio();
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(initialAspectRatio);
  // Track thumbnail-reported aspect ratio as ground truth
  const thumbnailRatioRef = useRef<number | null>(null);

  // NO useEffect here — useState(initialAspectRatio) sets the right value on mount,
  // and effectiveAspectRatio below overrides for classic Vines anyway.

  // For classic Vines, ALWAYS force 1:1 regardless of state — state might be
  // stale if video data changed after mount or component was recycled
  const effectiveAspectRatio = isClassicVine ? 1 : videoAspectRatio;

  // Thumbnail dimensions are the source of truth for content aspect ratio.
  // Thumbnails are simple images that preserve the original aspect ratio,
  // unlike HLS streams which may be transcoded to different dimensions.
  const handleThumbnailDimensions = useCallback((d: { width: number; height: number }) => {
    const newRatio = d.width / d.height;
    console.log(`[AspectRatio] THUMBNAIL video=${video.id?.slice(0, 8)} dims=${d.width}x${d.height} ratio=${newRatio.toFixed(3)} isClassicVine=${isClassicVine} → ${isClassicVine ? 'IGNORED (classic vine)' : 'APPLIED'}`);
    if (isClassicVine) return; // Classic Vines locked to 1:1
    thumbnailRatioRef.current = newRatio;
    setVideoAspectRatio(newRatio);
  }, [isClassicVine, video.id]);

  // Video player dimensions may be wrong due to HLS transcoding.
  // If thumbnail already established the correct ratio, don't override
  // unless the difference is trivial (< 10%, just codec rounding).
  const handleVideoDimensions = useCallback((d: { width: number; height: number }) => {
    const newRatio = d.width / d.height;
    const thumbRatio = thumbnailRatioRef.current;

    if (isClassicVine) {
      console.log(`[AspectRatio] VIDEO video=${video.id?.slice(0, 8)} dims=${d.width}x${d.height} ratio=${newRatio.toFixed(3)} → IGNORED (classic vine, forcing 1:1)`);
      return;
    }

    // If thumbnail already set the ratio, trust it over HLS
    if (thumbRatio !== null) {
      const ratioChange = Math.abs(newRatio - thumbRatio) / thumbRatio;
      if (ratioChange > 0.1) {
        console.log(`[AspectRatio] VIDEO video=${video.id?.slice(0, 8)} dims=${d.width}x${d.height} ratio=${newRatio.toFixed(3)} → IGNORED (${(ratioChange * 100).toFixed(0)}% off thumbnail=${thumbRatio.toFixed(3)})`);
        return; // >10% difference = HLS distortion, ignore
      }
    }

    if (hasDeclaredDimensions) {
      const isInitialPortraitOrSquare = initialAspectRatio <= 1.1;
      const isNewLandscape = newRatio > 1.1;
      // Don't let HLS flip a video with declared portrait/square dimensions to landscape
      if (isInitialPortraitOrSquare && isNewLandscape) {
        console.log(`[AspectRatio] VIDEO video=${video.id?.slice(0, 8)} dims=${d.width}x${d.height} ratio=${newRatio.toFixed(3)} → IGNORED (declared ${initialAspectRatio.toFixed(3)} but HLS says landscape)`);
        return;
      }
    }

    console.log(`[AspectRatio] VIDEO video=${video.id?.slice(0, 8)} dims=${d.width}x${d.height} ratio=${newRatio.toFixed(3)} → APPLIED (was ${videoAspectRatio.toFixed(3)})`);
    setVideoAspectRatio(newRatio);
  }, [initialAspectRatio, hasDeclaredDimensions, isClassicVine, video.id, videoAspectRatio]);
  const _isMobile = useIsMobile();
  // Determine layout: use prop if provided, otherwise always vertical (text below video)
  const effectiveLayout = layout ?? 'vertical';
  const isHorizontal = effectiveLayout === 'horizontal';
  const { toast } = useToast();
  const { share } = useShare();
  const muteUser = useMuteItem();
  const navigate = useSubdomainNavigate();
  const { globalMuted, setGlobalMuted } = useVideoPlayback();
  const { cues: subtitleCues, hasSubtitles } = useSubtitles(video);
  const [ccOverride, setCcOverride] = useState<boolean | undefined>(undefined);
  const subtitlesVisible = ccOverride ?? (globalMuted && hasSubtitles);

  // Reset ccOverride when mute state changes so auto-behavior resumes
  useEffect(() => {
    setCcOverride(undefined);
  }, [globalMuted]);

  const { mutate: deleteVideo, isPending: isDeleting } = useDeleteVideo();
  const canDelete = useCanDeleteVideo(video);

  // Get reactions data for the modal
  const { data: reactions } = useVideoReactions(video.id, video.pubkey, video.vineId);

  // Enhance author data with generated profiles
  const author = enhanceAuthorData(authorData.data, video.pubkey);
  const reposter = shouldShowReposter && reposterPubkey
    ? enhanceAuthorData(reposterData.data, reposterPubkey)
    : null;

  const metadata: NostrMetadata = author.metadata;
  const reposterMetadata: NostrMetadata | undefined = reposter?.metadata;

  const npub = nip19.npubEncode(video.pubkey);
  // Use raw author data (pre-enhancement) to detect real vs generated names
  // enhanceAuthorData fills in generated names like "ElectricVine742" — we don't want those
  const rawMetadata = authorData.data?.metadata;
  const hasRealName = rawMetadata?.display_name || rawMetadata?.name;
  // Display name priority: real profile name > Funnelcake cached name > shortened npub
  const displayName = hasRealName
    ? (rawMetadata.display_name || rawMetadata.name!)
    : (video.authorName || `${npub.slice(0, 12)}...`);
  // Avatar priority: real profile > Funnelcake cached > generated fallback
  const profileImage = getSafeProfileImage(
    rawMetadata?.picture || video.authorAvatar || metadata.picture
  );
  // Just use npub for now, we'll deal with NIP-05 later
  const profileUrl = `/${npub}`;

  const reposterNpub = reposterPubkey ? nip19.npubEncode(reposterPubkey) : '';
  const reposterName = reposterData.isLoading
    ? "Loading profile..."
    : (reposterMetadata?.name || (reposterPubkey ? `${reposterNpub.slice(0, 12)}...` : ''));

  // NEW: Get all unique reposters for display
  const allReposters = video.reposts || [];
  const uniqueReposterPubkeys = [...new Set(allReposters.map(r => r.reposterPubkey))];
  const repostCountDisplay = uniqueReposterPubkeys.length;

  // Format time - use original Vine timestamp if available, otherwise use created_at
  const timestamp = video.originalVineTimestamp || video.createdAt;

  const date = new Date(timestamp * 1000);

  // Check if this is a migrated Vine from original Vine platform (uses 'origin' tag)
  const isMigratedVine = video.isVineMigrated;

  // Calculate timeAgo only for pre-2025 videos
  const isFrom2025 = date.getFullYear() >= 2025;
  let timeAgo: string | null = null;
  if (!isFrom2025) {
    const now = new Date();
    const yearsDiff = now.getFullYear() - date.getFullYear();
    // If more than 1 year old, show the actual date
    if (yearsDiff > 1 || (yearsDiff === 1 && now.getTime() < new Date(date).setFullYear(date.getFullYear() + 1))) {
      timeAgo = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } else {
      timeAgo = formatDistanceToNow(date, { addSuffix: true });
    }
  }

  const handleCommentsClick = () => {
    onOpenComments?.(video);
  };

  const handleCloseCommentsModal = (open: boolean) => {
    if (!open) {
      onCloseComments?.();
    }
  };

  const handleThumbnailClick = () => {
    // In thumbnail mode (grid view), navigate to video page instead of playing inline
    if (mode === 'thumbnail') {
      navigate(`/video/${video.id}`, { ownerPubkey: video.pubkey });
    } else {
      setIsPlaying(true);
      onPlay?.();
    }
  };

  const handleVideoEnd = () => {
    if (mode === 'thumbnail') {
      setIsPlaying(false);
    }
  };

  const handleMuteUser = async () => {
    try {
      await muteUser.mutateAsync({
        type: MuteType.USER,
        value: video.pubkey,
        reason: 'Muted from video'
      });

      toast({
        title: 'User muted',
        description: `${displayName} has been muted`,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to mute user',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteVideo = (reason?: string) => {
    deleteVideo(
      { video, reason },
      {
        onSuccess: () => {
          setShowDeleteDialog(false);
        },
      }
    );
  };

  const handleShare = () => share(getVideoShareData(video));

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
      // Fetch the video and create a blob for download
      const response = await fetch(video.videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Create download link
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
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(video.videoUrl, '_blank');
    }
  };

  return (
    <>
      {/* Comments Modal */}
      <VideoCommentsModal
        video={video}
        open={showComments}
        onOpenChange={handleCloseCommentsModal}
      />

      {/* Add to List Dialog */}
      {video.vineId && showAddToListDialog && (
        <AddToListDialog
          videoId={video.vineId}
          videoPubkey={video.pubkey}
          open={showAddToListDialog}
          onClose={() => setShowAddToListDialog(false)}
        />
      )}

    <Card className={cn('overflow-hidden', className)}>
      {/* Repost indicator - NEW: Show repost count */}
      {hasReposts && (
        <div className="flex items-center gap-2 px-4 pt-3 text-sm text-muted-foreground">
          <Repeat2 className="h-4 w-4" />
          <span>
            {repostCountDisplay === 1 ? (
              <>{reposterName} reposted</>
            ) : (
              <>{reposterName} and {repostCountDisplay - 1} {repostCountDisplay === 2 ? 'other' : 'others'} reposted</>
            )}
          </span>
        </div>
      )}

      {/* Main content - horizontal or vertical layout */}
      <div className={cn(
        isHorizontal ? "flex flex-row" : "flex flex-col"
      )}>
        {/* Video section - fixed width in horizontal mode, full width in vertical */}
        <div className={cn(
          isHorizontal ? "w-[280px] flex-shrink-0" : "w-full"
        )}>
          {/* Author info - only show here in vertical layout */}
          {!isHorizontal && (
            <div className="flex items-center gap-3 p-4 pb-2">
              <SmartLink to={profileUrl} ownerPubkey={video.pubkey}>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profileImage} alt={displayName} />
                  <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
              </SmartLink>
              <div className="flex-1 min-w-0">
                <SmartLink to={profileUrl} ownerPubkey={video.pubkey} className="font-semibold hover:underline truncate">
                  {displayName}
                </SmartLink>
                {timeAgo && (
                  <SmartLink to={`/video/${video.id}`} ownerPubkey={video.pubkey} className="text-sm text-muted-foreground block hover:underline" title={new Date(timestamp * 1000).toLocaleString()}>
                    {timeAgo}
                  </SmartLink>
                )}
              </div>
              {/* Badges - right aligned */}
              <div className="flex items-center gap-2 shrink-0">
                {isMigratedVine && <VineBadge />}
                {video.proofMode && video.proofMode.level !== 'unverified' && (
                  <ProofModeBadge
                    level={video.proofMode.level}
                    proofData={video.proofMode}
                    showDetails={true}
                  />
                )}
              </div>
            </div>
          )}

          {/* Video player or thumbnail */}
          <CardContent className={cn("p-0", isHorizontal && "p-2")}
            data-aspect-ratio={effectiveAspectRatio.toFixed(3)}
            data-is-classic-vine={isClassicVine}
            data-video-id={video.id?.slice(0, 8)}
          >
            <div
              className={cn(
                "relative rounded-lg overflow-hidden w-full max-h-[70vh]",
                // Center non-landscape videos when height-constrained
                effectiveAspectRatio <= 1.1 && "mx-auto"
              )}
              style={{
                aspectRatio: effectiveAspectRatio.toString(),
                // For non-landscape videos, limit width so max-h-[70vh] doesn't stretch them wide
                maxWidth: effectiveAspectRatio <= 1.1 ? `calc(70vh * ${effectiveAspectRatio})` : undefined,
              }}
            >
              {!isPlaying ? (
                <ThumbnailPlayer
                  videoId={video.id}
                  src={video.videoUrl}
                  thumbnailUrl={video.thumbnailUrl}
                  duration={video.duration}
                  className="w-full h-full"
                  onClick={handleThumbnailClick}
                  onError={() => setVideoError(true)}
                  onVideoDimensions={handleThumbnailDimensions}
                />
              ) : !videoError ? (
                <VideoPlayer
                  videoId={video.id}
                  src={video.videoUrl}
                  hlsUrl={effectiveHlsUrl}
                  fallbackUrls={video.fallbackVideoUrls}
                  poster={video.thumbnailUrl}
                  blurhash={video.blurhash}
                  className="w-full h-full"
                  onLoadStart={() => setVideoError(false)}
                  onError={() => setVideoError(true)}
                  onEnded={handleVideoEnd}
                  onLoadedData={onLoadedData}
                  onVideoDimensions={handleVideoDimensions}
                  subtitleCues={subtitleCues}
                  subtitlesVisible={subtitlesVisible}
                  videoData={video}
                  trafficSource={trafficSource}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Failed to load video</p>
                </div>
              )}

              {/* CC button overlay - bottom right, next to mute */}
              {isPlaying && !videoError && hasSubtitles && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "absolute bottom-3 right-14 z-30",
                    "bg-black/50 hover:bg-black/70",
                    subtitlesVisible ? "text-white" : "text-white/50",
                    "backdrop-blur-sm rounded-full",
                    "w-10 h-10 p-0 flex items-center justify-center",
                    "transition-all duration-200"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCcOverride(prev => prev === undefined ? !subtitlesVisible : !prev);
                  }}
                  onTouchStart={(e) => { e.stopPropagation(); }}
                  onTouchEnd={(e) => { e.stopPropagation(); }}
                  aria-label={subtitlesVisible ? "Hide subtitles" : "Show subtitles"}
                >
                  <Captions className="h-5 w-5" />
                </Button>
              )}

              {/* Mute/Unmute button overlay - bottom right corner */}
              {isPlaying && !videoError && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "absolute bottom-3 right-3 z-30",
                    "bg-black/50 hover:bg-black/70 text-white",
                    "backdrop-blur-sm rounded-full",
                    "w-10 h-10 p-0 flex items-center justify-center",
                    "transition-all duration-200"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setGlobalMuted(!globalMuted);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                  }}
                  aria-label={globalMuted ? "Unmute" : "Mute"}
                >
                  {globalMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
              )}

              {/* Fullscreen button overlay - bottom left corner */}
              {isPlaying && !videoError && onEnterFullscreen && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "absolute bottom-3 left-3 z-30",
                    "bg-black/50 hover:bg-black/70 text-white",
                    "backdrop-blur-sm rounded-full",
                    "w-10 h-10 p-0 flex items-center justify-center",
                    "transition-all duration-200"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEnterFullscreen();
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                  }}
                  aria-label="Enter fullscreen"
                >
                  <Maximize2 className="h-5 w-5" />
                </Button>
              )}
            </div>
          </CardContent>
        </div>

        {/* Info panel - right side in horizontal, below video in vertical */}
        <div className={cn(
          "flex flex-col",
          isHorizontal ? "flex-1 p-3 justify-between min-w-0 overflow-hidden" : "w-full"
        )}>
          {/* Author info - horizontal layout only (shown above video in vertical) */}
          {isHorizontal && (
            <div className="flex items-start gap-2 mb-2">
              <SmartLink to={profileUrl} ownerPubkey={video.pubkey}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profileImage} alt={displayName} />
                  <AvatarFallback className="text-xs">{displayName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
              </SmartLink>
              <div className="flex-1 min-w-0">
                <SmartLink to={profileUrl} ownerPubkey={video.pubkey} className="font-semibold text-sm hover:underline block truncate">
                  {displayName}
                </SmartLink>
                {timeAgo && (
                  <SmartLink to={`/video/${video.id}`} ownerPubkey={video.pubkey} className="text-xs text-muted-foreground hover:underline" title={new Date(timestamp * 1000).toLocaleString()}>
                    {timeAgo}
                  </SmartLink>
                )}
              </div>
              {/* Badges - right aligned */}
              <div className="flex items-center gap-2 shrink-0">
                {isMigratedVine && <VineBadge />}
                {video.proofMode && video.proofMode.level !== 'unverified' && (
                  <ProofModeBadge
                    level={video.proofMode.level}
                    proofData={video.proofMode}
                    showDetails={true}
                  />
                )}
              </div>
            </div>
          )}

          {/* Title, description, hashtags */}
          <div className={cn(
            "flex-1 overflow-hidden",
            isHorizontal ? "space-y-1" : "p-4 space-y-2"
          )}>
            {video.title && (
              <SmartLink to={`/video/${video.id}`} ownerPubkey={video.pubkey}>
                <h3 className={cn("font-semibold line-clamp-2 hover:underline", isHorizontal ? "text-sm" : "text-lg")}>{video.title}</h3>
              </SmartLink>
            )}

            {video.content && video.content.trim() !== video.title?.trim() && (
              <div className={cn("whitespace-pre-wrap break-words", isHorizontal && "line-clamp-2")}>
                <NoteContent
                  event={{
                    id: video.id,
                    pubkey: video.pubkey,
                    created_at: video.createdAt,
                    kind: 1,
                    content: video.content,
                    tags: [],
                    sig: ''
                  }}
                  className={cn(isHorizontal ? "text-xs" : "text-sm")}
                />
              </div>
            )}

            {/* Hashtags - Vine green color in horizontal layout */}
            {video.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {video.hashtags.map((tag) => (
                  <SmartLink
                    key={tag}
                    to={`/hashtag/${tag}`}
                    className={cn(
                      "hover:underline",
                      isHorizontal ? "text-xs text-[#0d7a50] dark:text-[#00bf8f]" : "text-sm text-[#0d7a50] dark:text-primary"
                    )}
                  >
                    #{tag}
                  </SmartLink>
                ))}
              </div>
            )}

          </div>

          {/* Stats row - horizontal layout: show view/loop count only (likes/comments shown on buttons) */}
          {isHorizontal && viewCount > 0 && (
            <SmartLink to={`/video/${video.id}`} ownerPubkey={video.pubkey} className="py-2 mt-auto text-sm text-muted-foreground hover:underline block">
              {formatViewCount(viewCount)}
            </SmartLink>
          )}

          {/* Vertical layout: Video metadata row */}
          {!isHorizontal && (
            <div className="px-4 py-2" data-testid="video-metadata">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {viewCount > 0 && (
                  <SmartLink to={`/video/${video.id}`} ownerPubkey={video.pubkey} className="flex items-center gap-1 hover:underline">
                    <Eye className="h-3 w-3" />
                    {formatViewCount(viewCount)}
                  </SmartLink>
                )}
              </div>
            </div>
          )}

          {/* Interaction buttons */}
          <div className={cn(
            "flex items-center",
            isHorizontal ? "pt-2 gap-1" : "px-4 pb-4 gap-0.5"
          )}>
          {/* Like button - icon toggles, count shows modal */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                isHorizontal ? 'gap-2 pr-1' : 'gap-1 px-2 pr-1',
                isLiked && 'text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30'
              )}
              onClick={onLike}
              aria-label={isLiked ? "Unlike" : "Like"}
            >
              <Heart className={cn('h-4 w-4', isLiked && 'fill-current')} />
            </Button>
            {likeCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReactionsModal('likes');
                }}
                className={cn(
                  "text-xs text-muted-foreground hover:text-foreground transition-colors px-1",
                  isLiked && 'text-red-500 hover:text-red-600'
                )}
                aria-label="View who liked this video"
              >
                {formatCount(likeCount)}
              </button>
            )}
          </div>

          {/* Repost button - icon toggles, count shows modal */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                isHorizontal ? 'gap-2 pr-1' : 'gap-1 px-2 pr-1',
                isReposted && 'text-green-500 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30'
              )}
              onClick={onRepost}
              aria-label={isReposted ? "Remove repost" : "Repost"}
            >
              <Repeat2 className={cn('h-4 w-4', isReposted && 'fill-current')} />
            </Button>
            {repostCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReactionsModal('reposts');
                }}
                className={cn(
                  "text-xs text-muted-foreground hover:text-foreground transition-colors px-1",
                  isReposted && 'text-green-500 hover:text-green-600'
                )}
                aria-label="View who reposted this video"
              >
                {formatCount(repostCount)}
              </button>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2",
              !isHorizontal && "gap-1 px-2"
            )}
            onClick={handleCommentsClick}
            aria-label="Comment"
          >
            <MessageCircle className="h-4 w-4" />
            {commentCount > 0 && <span className="text-xs">{formatCount(commentCount)}</span>}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2",
              !isHorizontal && "px-2"
            )}
            onClick={handleShare}
            aria-label="Share"
          >
            <Share className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2",
              !isHorizontal && "px-2"
            )}
            onClick={handleDownload}
            aria-label="Download"
          >
            <Download className="h-4 w-4" />
          </Button>

          {/* Lists button */}
          {video.vineId && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-2",
                !isHorizontal && "gap-1 px-2"
              )}
              onClick={() => setShowAddToListDialog(true)}
              aria-label="Lists"
            >
              {(lists?.length ?? 0) > 0 ? <Users className="h-4 w-4" /> : <ListPlus className="h-4 w-4" />}
              {isHorizontal && <span className="text-xs">Lists</span>}
              {lists && lists.length > 0 && isHorizontal && <span className="text-xs">{formatCount(lists.length)}</span>}
            </Button>
          )}

          {/* More options menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="px-2"
                aria-label="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canDelete && (
                <>
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete video
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => setShowReportDialog(true)}>
                <Flag className="h-4 w-4 mr-2" />
                Report video
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowReportUserDialog(true)}>
                <Flag className="h-4 w-4 mr-2" />
                Report user
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleMuteUser} className="text-destructive focus:text-destructive">
                <UserX className="h-4 w-4 mr-2" />
                Mute {displayName}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowViewSourceDialog(true)}>
                <Code className="h-4 w-4 mr-2" />
                View source
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </div>
    </Card>

    {/* Dialogs */}
    {showReportDialog && (
      <ReportContentDialog
        open={showReportDialog}
        onClose={() => setShowReportDialog(false)}
        eventId={video.id}
        pubkey={video.pubkey}
        contentType="video"
      />
    )}

    {showReportUserDialog && (
      <ReportContentDialog
        open={showReportUserDialog}
        onClose={() => setShowReportUserDialog(false)}
        pubkey={video.pubkey}
        contentType="user"
      />
    )}

    {showDeleteDialog && (
      <DeleteVideoDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteVideo}
        video={video}
        isDeleting={isDeleting}
      />
    )}

    {showViewSourceDialog && (
      <ViewSourceDialog
        open={showViewSourceDialog}
        onClose={() => setShowViewSourceDialog(false)}
        video={video}
        title="Video Event Source"
      />
    )}

    {/* Reactions Modal - shows who liked/reposted */}
    <VideoReactionsModal
      open={showReactionsModal !== null}
      onOpenChange={(open) => !open && setShowReactionsModal(null)}
      reactions={reactions}
      type={showReactionsModal || 'likes'}
    />
    </>
  );
}
