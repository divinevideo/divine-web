// ABOUTME: Individual fullscreen video component for TikTok-style vertical swipe feed
// ABOUTME: Displays video with overlay UI including back button, author info, and action buttons

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Repeat2, Share, Volume2, VolumeX, Download, ListPlus, Users, MoreVertical, Flag, UserX, Code, Trash2, Eye } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { VideoPlayer } from '@/components/VideoPlayer';
import { VideoCommentsModal } from '@/components/VideoCommentsModal';
import { VideoReactionsModal } from '@/components/VideoReactionsModal';
import { NoteContent } from '@/components/NoteContent';
import { VineBadge } from '@/components/VineBadge';
import { ProofModeBadge } from '@/components/ProofModeBadge';
import { AddToListDialog } from '@/components/AddToListDialog';
import { ReportContentDialog } from '@/components/ReportContentDialog';
import { DeleteVideoDialog } from '@/components/DeleteVideoDialog';
import { ViewSourceDialog } from '@/components/ViewSourceDialog';
import { useAuthor } from '@/hooks/useAuthor';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';
import { useVideoReactions } from '@/hooks/useVideoReactions';
import { useVideosInLists } from '@/hooks/useVideoLists';
import { useMuteItem } from '@/hooks/useModeration';
import { useDeleteVideo, useCanDeleteVideo } from '@/hooks/useDeleteVideo';
import { useToast } from '@/hooks/useToast';
import { enhanceAuthorData } from '@/lib/generateProfile';
import { formatDistanceToNow } from 'date-fns';
import { formatCount, formatViewCount } from '@/lib/formatUtils';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { cn } from '@/lib/utils';
import { MuteType } from '@/types/moderation';
import type { ParsedVideoData } from '@/types/video';

interface FullscreenVideoItemProps {
  video: ParsedVideoData;
  isActive: boolean;
  onBack: () => void;
  onLike: () => void;
  onRepost: () => void;
  onShare: () => void;
  onDownload: () => void;
  isLiked: boolean;
  isReposted: boolean;
  likeCount: number;
  repostCount: number;
  commentCount: number;
  viewCount?: number;
}

export function FullscreenVideoItem({
  video,
  isActive,
  onBack,
  onLike,
  onRepost,
  onShare,
  onDownload,
  isLiked,
  isReposted,
  likeCount,
  repostCount,
  commentCount,
  viewCount = 0,
}: FullscreenVideoItemProps) {
  const [showComments, setShowComments] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [showReactionsModal, setShowReactionsModal] = useState<'likes' | 'reposts' | null>(null);
  const [showAddToListDialog, setShowAddToListDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showReportUserDialog, setShowReportUserDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showViewSourceDialog, setShowViewSourceDialog] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const { globalMuted, setGlobalMuted, setActiveVideo } = useVideoPlayback();
  const { toast } = useToast();
  const muteUser = useMuteItem();
  const { mutate: deleteVideo, isPending: isDeleting } = useDeleteVideo();
  const canDelete = useCanDeleteVideo(video);
  const { data: reactions } = useVideoReactions(video.id, video.pubkey, video.vineId);
  const { data: lists } = useVideosInLists(video.vineId ?? undefined);

  // Get author data
  const authorData = useAuthor(video.pubkey);
  const author = enhanceAuthorData(authorData.data, video.pubkey);
  const metadata = author.metadata;

  const npub = nip19.npubEncode(video.pubkey);
  const hasRealProfile = authorData.data?.event && authorData.data?.metadata?.name;
  const displayName = authorData.isLoading
    ? (video.authorName || "Loading...")
    : hasRealProfile
      ? (metadata.display_name || metadata.name || `${npub.slice(0, 12)}...`)
      : (video.authorName || metadata.display_name || metadata.name || `${npub.slice(0, 12)}...`);
  const profileImage = getSafeProfileImage(
    (hasRealProfile ? metadata.picture : null) || video.authorAvatar || metadata.picture
  );
  const profileUrl = `/${npub}`;

  // Format timestamp
  const timestamp = video.originalVineTimestamp || video.createdAt;
  const date = new Date(timestamp * 1000);
  const isFrom2025 = date.getFullYear() >= 2025;
  let timeAgo: string | null = null;
  if (!isFrom2025) {
    const now = new Date();
    const yearsDiff = now.getFullYear() - date.getFullYear();
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

  // Set this video as active when it becomes visible
  useEffect(() => {
    if (isActive) {
      setActiveVideo(video.id);
    }
  }, [isActive, video.id, setActiveVideo]);

  // Handle tap on video area to toggle play/pause
  const handleOverlayClick = useCallback(() => {
    // Find the video element and toggle play
    const videoEl = document.querySelector(`video`) as HTMLVideoElement;
    if (videoEl) {
      if (videoEl.paused) {
        videoEl.play();
      } else {
        videoEl.pause();
      }
    }
  }, []);

  // Handle double-tap to like
  const handleDoubleTap = useCallback(() => {
    onLike();
    // Show heart animation
    setShowHeartAnimation(true);
    setTimeout(() => setShowHeartAnimation(false), 800);
  }, [onLike]);

  // Handle swipe right to exit
  const handleSwipeRight = useCallback(() => {
    onBack();
  }, [onBack]);

  // Handle mute user
  const handleMuteUser = async () => {
    try {
      await muteUser.mutateAsync({
        type: MuteType.USER,
        value: video.pubkey,
        reason: 'Muted from fullscreen video'
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

  // Handle delete video
  const handleDeleteVideo = (reason?: string) => {
    deleteVideo(
      { video, reason },
      {
        onSuccess: () => {
          setShowDeleteDialog(false);
          onBack();
        },
      }
    );
  };

  // Check if this is a migrated Vine
  const isMigratedVine = video.isVineMigrated;

  return (
    <div
      ref={videoContainerRef}
      className="h-screen w-full snap-start snap-always relative bg-black flex items-center justify-center"
    >
      {/* Video player - full screen, behind overlay */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        {!videoError ? (
          <VideoPlayer
            videoId={video.id}
            src={video.videoUrl}
            hlsUrl={video.hlsUrl}
            fallbackUrls={video.fallbackVideoUrls}
            poster={video.thumbnailUrl}
            blurhash={video.blurhash}
            className="w-full h-full object-contain"
            onError={() => setVideoError(true)}
            onSwipeRight={handleSwipeRight}
            onDoubleTap={handleDoubleTap}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white">
            <p>Failed to load video</p>
          </div>
        )}
      </div>

      {/* Heart animation on double-tap */}
      {showHeartAnimation && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <Heart
            className="h-24 w-24 text-red-500 fill-current animate-ping"
            style={{ animationDuration: '0.6s' }}
          />
        </div>
      )}

      {/* Overlay UI - z-50 */}
      <div className="absolute inset-0 z-50 pointer-events-none">
        {/* Tap area for play/pause - covers the center, behind buttons */}
        <div
          className="absolute inset-0 pointer-events-auto"
          onClick={handleOverlayClick}
        />

        {/* Back button - top left */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm rounded-full w-10 h-10 pointer-events-auto"
          onClick={(e) => { e.stopPropagation(); onBack(); }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Mute/Unmute button - top right */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm rounded-full w-10 h-10 pointer-events-auto"
          onClick={(e) => { e.stopPropagation(); setGlobalMuted(!globalMuted); }}
        >
          {globalMuted ? (
            <VolumeX className="h-5 w-5" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </Button>

        {/* Bottom overlay - author info and actions */}
        <div className="absolute bottom-0 left-0 right-0 pb-8" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-end justify-between px-4">
            {/* Left side - Author info */}
            <div className="flex-1 max-w-[70%]">
              <Link to={profileUrl} className="flex items-center gap-3 mb-2 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                <Avatar className="h-10 w-10 border-2 border-white">
                  <AvatarImage src={profileImage} alt={displayName} />
                  <AvatarFallback className="bg-gray-800 text-white">
                    {displayName[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white drop-shadow-lg">{displayName}</p>
                    {isMigratedVine && <VineBadge />}
                    {video.proofMode && video.proofMode.level !== 'unverified' && (
                      <ProofModeBadge level={video.proofMode.level} proofData={video.proofMode} />
                    )}
                  </div>
                  {timeAgo && (
                    <p className="text-sm text-white/80 drop-shadow-lg">{timeAgo}</p>
                  )}
                </div>
              </Link>

              {/* Title/Description with NoteContent parsing */}
              {(video.title || video.content) && (
                <div className="text-white text-sm drop-shadow-lg line-clamp-2 mb-2 pointer-events-auto">
                  <NoteContent
                    event={{
                      id: video.id,
                      pubkey: video.pubkey,
                      created_at: video.createdAt,
                      kind: 1,
                      content: video.title || video.content || '',
                      tags: [],
                      sig: ''
                    }}
                    className="text-sm text-white"
                  />
                </div>
              )}

              {/* Hashtags */}
              {video.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 pointer-events-auto">
                  {video.hashtags.slice(0, 3).map((tag) => (
                    <Link
                      key={tag}
                      to={`/hashtag/${tag}`}
                      className="text-sm text-[#00bf8f] drop-shadow-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      #{tag}
                    </Link>
                  ))}
                  {video.hashtags.length > 3 && (
                    <span className="text-sm text-white/60">+{video.hashtags.length - 3}</span>
                  )}
                </div>
              )}

              {/* View count */}
              {viewCount > 0 && (
                <div className="flex items-center gap-1 text-sm text-white/80 drop-shadow-lg mt-1">
                  <Eye className="h-3 w-3" />
                  {formatViewCount(viewCount)}
                </div>
              )}
            </div>

            {/* Right side - Action buttons */}
            <div className="flex flex-col items-center gap-4 pointer-events-auto">
              {/* Like button with clickable count */}
              <div className="flex flex-col items-center">
                <button
                  onClick={(e) => { e.stopPropagation(); onLike(); }}
                  className="flex flex-col items-center"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm",
                    isLiked && "bg-red-500/80"
                  )}>
                    <Heart className={cn("h-6 w-6 text-white", isLiked && "fill-current")} />
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowReactionsModal('likes'); }}
                  className="text-white text-xs mt-1 drop-shadow-lg hover:underline"
                >
                  {formatCount(likeCount)}
                </button>
              </div>

              {/* Comment button */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
                className="flex flex-col items-center"
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <MessageCircle className="h-6 w-6 text-white" />
                </div>
                <span className="text-white text-xs mt-1 drop-shadow-lg">{formatCount(commentCount)}</span>
              </button>

              {/* Repost button with clickable count */}
              <div className="flex flex-col items-center">
                <button
                  onClick={(e) => { e.stopPropagation(); onRepost(); }}
                  className="flex flex-col items-center"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm",
                    isReposted && "bg-green-500/80"
                  )}>
                    <Repeat2 className={cn("h-6 w-6 text-white", isReposted && "fill-current")} />
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowReactionsModal('reposts'); }}
                  className="text-white text-xs mt-1 drop-shadow-lg hover:underline"
                >
                  {formatCount(repostCount)}
                </button>
              </div>

              {/* Share button */}
              <button
                onClick={(e) => { e.stopPropagation(); onShare(); }}
                className="flex flex-col items-center"
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <Share className="h-6 w-6 text-white" />
                </div>
              </button>

              {/* Download button */}
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(); }}
                className="flex flex-col items-center"
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <Download className="h-6 w-6 text-white" />
                </div>
              </button>

              {/* Lists button */}
              {video.vineId && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAddToListDialog(true); }}
                  className="flex flex-col items-center"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    {(lists?.length ?? 0) > 0 ? <Users className="h-6 w-6 text-white" /> : <ListPlus className="h-6 w-6 text-white" />}
                  </div>
                </button>
              )}

              {/* More menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm">
                      <MoreVertical className="h-6 w-6 text-white" />
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-black/90 border-white/20 text-white">
                  {canDelete && (
                    <>
                      <DropdownMenuItem
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-red-400 focus:text-red-400 focus:bg-red-500/20"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete video
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/20" />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={() => setShowReportDialog(true)}
                    className="focus:bg-white/10"
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    Report video
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowReportUserDialog(true)}
                    className="focus:bg-white/10"
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    Report user
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/20" />
                  <DropdownMenuItem
                    onClick={handleMuteUser}
                    className="text-red-400 focus:text-red-400 focus:bg-red-500/20"
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    Mute {displayName}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/20" />
                  <DropdownMenuItem
                    onClick={() => setShowViewSourceDialog(true)}
                    className="focus:bg-white/10"
                  >
                    <Code className="h-4 w-4 mr-2" />
                    View source
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Comments modal */}
      <VideoCommentsModal
        video={video}
        open={showComments}
        onOpenChange={setShowComments}
      />

      {/* Reactions modal - shows who liked/reposted */}
      <VideoReactionsModal
        open={showReactionsModal !== null}
        onOpenChange={(open) => !open && setShowReactionsModal(null)}
        reactions={reactions}
        type={showReactionsModal || 'likes'}
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

      {/* Report video dialog */}
      {showReportDialog && (
        <ReportContentDialog
          open={showReportDialog}
          onClose={() => setShowReportDialog(false)}
          eventId={video.id}
          pubkey={video.pubkey}
          contentType="video"
        />
      )}

      {/* Report user dialog */}
      {showReportUserDialog && (
        <ReportContentDialog
          open={showReportUserDialog}
          onClose={() => setShowReportUserDialog(false)}
          pubkey={video.pubkey}
          contentType="user"
        />
      )}

      {/* Delete video dialog */}
      {showDeleteDialog && (
        <DeleteVideoDialog
          open={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDeleteVideo}
          video={video}
          isDeleting={isDeleting}
        />
      )}

      {/* View source dialog */}
      {showViewSourceDialog && (
        <ViewSourceDialog
          open={showViewSourceDialog}
          onClose={() => setShowViewSourceDialog(false)}
          video={video}
          title="Video Event Source"
        />
      )}
    </div>
  );
}
