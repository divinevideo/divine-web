// ABOUTME: Individual fullscreen video component for TikTok-style vertical swipe feed
// ABOUTME: Displays video with overlay UI including back button, author info, and action buttons

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Repeat2, Share, Volume2, VolumeX, Download } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VideoPlayer } from '@/components/VideoPlayer';
import { VideoCommentsModal } from '@/components/VideoCommentsModal';
import { useAuthor } from '@/hooks/useAuthor';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';
import { enhanceAuthorData } from '@/lib/generateProfile';
import { formatDistanceToNow } from 'date-fns';
import { formatCount } from '@/lib/formatUtils';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { cn } from '@/lib/utils';
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
}: FullscreenVideoItemProps) {
  const [showComments, setShowComments] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const { globalMuted, setGlobalMuted, setActiveVideo } = useVideoPlayback();

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

  // Handle swipe right to exit
  const handleSwipeRight = useCallback(() => {
    onBack();
  }, [onBack]);

  return (
    <div
      ref={videoContainerRef}
      className="h-screen w-full snap-start snap-always relative bg-black flex items-center justify-center"
    >
      {/* Video player - full screen, behind overlay, no pointer events */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
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
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white">
            <p>Failed to load video</p>
          </div>
        )}
      </div>

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
              <Link to={profileUrl} className="flex items-center gap-3 mb-2" onClick={(e) => e.stopPropagation()}>
                <Avatar className="h-10 w-10 border-2 border-white">
                  <AvatarImage src={profileImage} alt={displayName} />
                  <AvatarFallback className="bg-gray-800 text-white">
                    {displayName[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-white drop-shadow-lg">{displayName}</p>
                  {timeAgo && (
                    <p className="text-sm text-white/80 drop-shadow-lg">{timeAgo}</p>
                  )}
                </div>
              </Link>

              {/* Title/Description */}
              {(video.title || video.content) && (
                <p className="text-white text-sm drop-shadow-lg line-clamp-2 mb-2">
                  {video.title || video.content}
                </p>
              )}

              {/* Hashtags */}
              {video.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
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
            </div>

            {/* Right side - Action buttons */}
            <div className="flex flex-col items-center gap-4 ">
              {/* Like button */}
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
                <span className="text-white text-xs mt-1 drop-shadow-lg">{formatCount(likeCount)}</span>
              </button>

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

              {/* Repost button */}
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
                <span className="text-white text-xs mt-1 drop-shadow-lg">{formatCount(repostCount)}</span>
              </button>

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
    </div>
  );
}
