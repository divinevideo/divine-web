// ABOUTME: Video card component for displaying individual videos in feeds
// ABOUTME: Shows video player, metadata, author info, and social interactions

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Repeat2, MessageCircle, Share, Eye, MoreVertical, Flag, UserX, Trash2, Volume2, VolumeX, Code, Users, ListPlus } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { VideoPlayer } from '@/components/VideoPlayer';
import { VideoCommentsModal } from '@/components/VideoCommentsModal';
import { ThumbnailPlayer } from '@/components/ThumbnailPlayer';
import { NoteContent } from '@/components/NoteContent';
import { VideoListBadges } from '@/components/VideoListBadges';
import { ProofModeBadge } from '@/components/ProofModeBadge';
import { OriginalContentBadge } from '@/components/OriginalContentBadge';
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
import { formatViewCount, formatDuration, formatCount } from '@/lib/formatUtils';
import { getSafeProfileImage } from '@/lib/imageUtils';
import type { VideoNavigationContext } from '@/hooks/useVideoNavigation';
import { useToast } from '@/hooks/useToast';
import { MuteType } from '@/types/moderation';

interface VideoCardProps {
  video: ParsedVideoData;
  className?: string;
  mode?: 'thumbnail' | 'auto-play';
  onLike?: () => void;
  onRepost?: () => void;
  onOpenComments?: (video: ParsedVideoData) => void;
  onCloseComments?: () => void;
  onPlay?: () => void;
  onLoadedData?: () => void;
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
}

export function VideoCard({
  video,
  className,
  mode = 'auto-play',
  onLike,
  onRepost,
  onOpenComments,
  onCloseComments,
  onPlay,
  onLoadedData,
  isLiked = false,
  isReposted = false,
  likeCount = 0,
  repostCount = 0,
  commentCount = 0,
  viewCount: _viewCount,
  showComments = false,
  navigationContext: _navigationContext,
  videoIndex: _videoIndex,
}: VideoCardProps) {
  const authorData = useAuthor(video.pubkey);
  const { data: lists } = useVideosInLists(video.vineId ?? undefined);

  // NEW: Get reposter data from reposts array
  const hasReposts = video.reposts && video.reposts.length > 0;
  const latestRepost = hasReposts ? video.reposts[video.reposts.length - 1] : null;
  const reposterPubkey = latestRepost?.reposterPubkey;
  const reposterData = useAuthor(reposterPubkey || '');
  const shouldShowReposter = hasReposts && reposterPubkey;
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(mode === 'auto-play');
  const [showAddToListDialog, setShowAddToListDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showReportUserDialog, setShowReportUserDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showViewSourceDialog, setShowViewSourceDialog] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const muteUser = useMuteItem();
  const navigate = useNavigate();
  const { globalMuted, setGlobalMuted } = useVideoPlayback();
  const { mutate: deleteVideo, isPending: isDeleting } = useDeleteVideo();
  const canDelete = useCanDeleteVideo(video);

  // Enhance author data with generated profiles
  const author = enhanceAuthorData(authorData.data, video.pubkey);
  const reposter = shouldShowReposter && reposterPubkey
    ? enhanceAuthorData(reposterData.data, reposterPubkey)
    : null;

  const metadata: NostrMetadata = author.metadata;
  const reposterMetadata: NostrMetadata | undefined = reposter?.metadata;

  const npub = nip19.npubEncode(video.pubkey);
  // Show "Loading profile..." while loading, otherwise show truncated npub if no profile exists
  const displayName = authorData.isLoading
    ? "Loading profile..."
    : (metadata.display_name || metadata.name || `${npub.slice(0, 12)}...`);
  const profileImage = getSafeProfileImage(metadata.picture);
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
      navigate(`/video/${video.id}`);
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

  const handleShare = async () => {
    const videoUrl = `${window.location.origin}/video/${video.id}`;

    // Use Web Share API if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: video.title || 'Check out this video on diVine Web',
          text: video.content || 'Short-form looping video on Nostr',
          url: videoUrl,
        });
      } catch (error) {
        // User cancelled or error occurred
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error);
          toast({
            title: 'Error',
            description: 'Failed to share video',
            variant: 'destructive',
          });
        }
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(videoUrl);
        toast({
          title: 'Link copied!',
          description: 'Video link has been copied to clipboard',
        });
      } catch (error) {
        console.error('Failed to copy link:', error);
        toast({
          title: 'Error',
          description: 'Failed to copy link to clipboard',
          variant: 'destructive',
        });
      }
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

      {/* Main content - horizontal on desktop, vertical on mobile */}
      <div className={cn(
        isMobile ? "flex flex-col" : "flex flex-row"
      )}>
        {/* Video section */}
        <div className={cn(
          isMobile ? "w-full" : "w-auto flex-shrink-0"
        )}>
          {/* Author info - only show here on mobile */}
          {isMobile && (
            <div className="flex items-center gap-3 p-4 pb-2">
              <Link to={profileUrl}>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profileImage} alt={displayName} />
                  <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={profileUrl} className="font-semibold hover:underline truncate">
                  {displayName}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  {video.proofMode && video.proofMode.level !== 'unverified' && (
                    <ProofModeBadge
                      level={video.proofMode.level}
                      proofData={video.proofMode}
                      showDetails={true}
                    />
                  )}
                  {date.getFullYear() < 2018 && (
                    <OriginalContentBadge size="small" />
                  )}
                </div>
              </div>
              {(isMigratedVine || timeAgo) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                  {isMigratedVine && <VineBadge />}
                  {timeAgo && (
                    <span title={new Date(timestamp * 1000).toLocaleString()}>
                      {timeAgo}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Video player or thumbnail */}
          <CardContent className={cn("p-0", !isMobile && "p-2")}>
            <div
              className={cn(
                "relative bg-black rounded-lg overflow-hidden",
                isMobile ? "w-full" : "h-[280px]"
              )}
              style={isMobile ? { aspectRatio: videoAspectRatio?.toString() || '1' } : undefined}
            >
              {!isPlaying ? (
                <ThumbnailPlayer
                  videoId={video.id}
                  src={video.videoUrl}
                  thumbnailUrl={video.thumbnailUrl}
                  duration={video.duration}
                  className={cn(
                    "w-full h-full",
                    !videoAspectRatio && "opacity-0",
                    !isMobile && "object-contain"
                  )}
                  onClick={handleThumbnailClick}
                  onError={() => setVideoError(true)}
                  onVideoDimensions={(d) => setVideoAspectRatio(d.width / d.height)}
                />
              ) : !videoError ? (
                <VideoPlayer
                  videoId={video.id}
                  src={video.videoUrl}
                  hlsUrl={video.hlsUrl}
                  fallbackUrls={video.fallbackVideoUrls}
                  poster={video.thumbnailUrl}
                  blurhash={video.blurhash}
                  className={cn("w-full h-full", !isMobile && "object-contain")}
                  onLoadStart={() => setVideoError(false)}
                  onError={() => setVideoError(true)}
                  onEnded={handleVideoEnd}
                  onLoadedData={onLoadedData}
                  onVideoDimensions={(d) => setVideoAspectRatio(d.width / d.height)}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Failed to load video</p>
                </div>
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
            </div>
          </CardContent>
        </div>

        {/* Info panel - right side on desktop, below video on mobile */}
        <div className={cn(
          "flex flex-col",
          isMobile ? "w-full" : "flex-1 p-3 h-[280px] justify-between min-w-0 overflow-hidden"
        )}>
          {/* Author info - desktop only (shown inline on mobile above) */}
          {!isMobile && (
            <div className="flex items-start gap-2 mb-2">
              <Link to={profileUrl}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profileImage} alt={displayName} />
                  <AvatarFallback className="text-xs">{displayName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={profileUrl} className="font-semibold text-sm hover:underline block truncate">
                  {displayName}
                </Link>
                {timeAgo && (
                  <span className="text-xs text-muted-foreground" title={new Date(timestamp * 1000).toLocaleString()}>
                    {timeAgo}
                  </span>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {isMigratedVine && <VineBadge />}
                  {video.proofMode && video.proofMode.level !== 'unverified' && (
                    <ProofModeBadge
                      level={video.proofMode.level}
                      proofData={video.proofMode}
                      showDetails={true}
                    />
                  )}
                  {date.getFullYear() < 2018 && (
                    <OriginalContentBadge size="small" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Title, description, hashtags */}
          <div className={cn(
            "flex-1 overflow-hidden",
            isMobile ? "p-4 space-y-2" : "space-y-1"
          )}>
            {video.title && (
              <h3 className={cn("font-semibold line-clamp-2", isMobile ? "text-lg" : "text-sm")}>{video.title}</h3>
            )}

            {video.content && video.content.trim() !== video.title?.trim() && (
              <div className={cn("whitespace-pre-wrap break-words", !isMobile && "line-clamp-2")}>
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
                  className={cn(isMobile ? "text-sm" : "text-xs")}
                />
              </div>
            )}

            {/* Hashtags - Vine green color on desktop */}
            {video.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {video.hashtags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/hashtag/${tag}`}
                    className={cn(
                      "hover:underline",
                      isMobile ? "text-sm text-primary" : "text-xs text-[#00bf8f]"
                    )}
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            {/* List badges */}
            {video.vineId && (
              <VideoListBadges
                videoId={video.vineId}
                videoPubkey={video.pubkey}
                compact={true}
                showAddButton={false}
              />
            )}
          </div>

          {/* Stats row - desktop: show loop count only (likes/comments shown on buttons) */}
          {!isMobile && (video.loopCount ?? 0) > 0 && (
            <div className="py-2 mt-auto text-sm text-muted-foreground">
              {formatViewCount(video.loopCount!)}
            </div>
          )}

          {/* Mobile: Video metadata row */}
          {isMobile && (
            <div className="px-4 py-2" data-testid="video-metadata">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {(video.loopCount ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {formatViewCount(video.loopCount!)}
                  </span>
                )}
                {(video.duration ?? 0) > 0 && (
                  <span>{formatDuration(video.duration!)}</span>
                )}
              </div>
            </div>
          )}

          {/* Interaction buttons */}
          <div className={cn(
            "flex items-center",
            isMobile ? "px-4 pb-4 gap-0.5" : "pt-2 gap-1"
          )}>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              isMobile ? 'gap-1 px-2' : 'gap-2',
              isLiked && 'text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30'
            )}
            onClick={onLike}
            aria-label={isLiked ? "Unlike" : "Like"}
          >
            <Heart className={cn('h-4 w-4', isLiked && 'fill-current')} />
            {likeCount > 0 && <span className="text-xs">{formatCount(likeCount)}</span>}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              isMobile ? 'gap-1 px-2' : 'gap-2',
              isReposted && 'text-green-500 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30'
            )}
            onClick={onRepost}
            aria-label={isReposted ? "Remove repost" : "Repost"}
          >
            <Repeat2 className={cn('h-4 w-4', isReposted && 'fill-current')} />
            {repostCount > 0 && <span className="text-xs">{formatCount(repostCount)}</span>}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2",
              isMobile && "gap-1 px-2"
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
              isMobile && "px-2"
            )}
            onClick={handleShare}
            aria-label="Share"
          >
            <Share className="h-4 w-4" />
          </Button>

          {/* Lists button */}
          {video.vineId && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-2",
                isMobile && "gap-1 px-2"
              )}
              onClick={() => setShowAddToListDialog(true)}
              aria-label="Lists"
            >
              {(lists?.length ?? 0) > 0 ? <Users className="h-4 w-4" /> : <ListPlus className="h-4 w-4" />}
              {!isMobile && <span className="text-xs">Lists</span>}
              {lists && lists.length > 0 && !isMobile && <span className="text-xs">{formatCount(lists.length)}</span>}
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
    </>
  );
}
