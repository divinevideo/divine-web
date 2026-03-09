// ABOUTME: Full-viewport mobile video component with Figma-matched overlaid UI
// ABOUTME: Renders a single video in the mobile swipe feed with action column, author overlay, and heart animation

import { useState, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Repeat2, Share2, ChevronDown } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { VideoPlayer } from '@/components/VideoPlayer';
import { VideoCommentsModal } from '@/components/VideoCommentsModal';
import { SmartLink } from '@/components/SmartLink';
import { NoteContent } from '@/components/NoteContent';
import { VideoVerificationBadgeRow } from '@/components/VideoVerificationBadgeRow';
import { InlineBadges } from '@/components/InlineBadges';
import { useAuthor } from '@/hooks/useAuthor';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';
import { useDeferredVideoMetrics } from '@/hooks/useDeferredVideoMetrics';
import { useOptimisticLike } from '@/hooks/useOptimisticLike';
import { useOptimisticRepost } from '@/hooks/useOptimisticRepost';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginDialog } from '@/contexts/LoginDialogContext';
import { useShare } from '@/hooks/useShare';
import { useToast } from '@/hooks/useToast';
import { useBadges } from '@/hooks/useBadges';
import { useBandwidthTier } from '@/hooks/useBandwidthTier';
import { useSubtitles } from '@/hooks/useSubtitles';
import { enhanceAuthorData } from '@/lib/generateProfile';
import { genUserName } from '@/lib/genUserName';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { getOptimalVideoUrl } from '@/lib/bandwidthTracker';
import { getVideoShareData } from '@/lib/shareUtils';
import { formatCount } from '@/lib/formatUtils';
import { cn } from '@/lib/utils';
import { debugLog } from '@/lib/debug';
import type { ParsedVideoData } from '@/types/video';
import type { VideoNavigationContext } from '@/hooks/useVideoNavigation';

interface MobileVideoItemProps {
  video: ParsedVideoData;
  isActive: boolean;
  onOpenComments?: (video: ParsedVideoData) => void;
  navigationContext?: VideoNavigationContext;
  videoIndex?: number;
}

export function MobileVideoItem({
  video,
  isActive,
  onOpenComments,
  navigationContext: _navigationContext,
  videoIndex = 0,
}: MobileVideoItemProps) {
  // --- Video playback ---
  const _bandwidthTier = useBandwidthTier();
  const optimalHlsUrl = getOptimalVideoUrl(video.videoUrl);
  const effectiveHlsUrl = video.hlsUrl || (optimalHlsUrl !== video.videoUrl ? optimalHlsUrl : undefined);
  const { setActiveVideo } = useVideoPlayback();
  const { cues: subtitleCues, hasSubtitles } = useSubtitles(video);
  const [subtitlesVisible, setSubtitlesVisible] = useState(true);
  const showSubtitles = subtitlesVisible && hasSubtitles;

  const [videoError, setVideoError] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // --- Auth & social ---
  const { user } = useCurrentUser();
  const { openLoginDialog } = useLoginDialog();
  const { toggleLike } = useOptimisticLike();
  const { toggleRepost } = useOptimisticRepost();
  const { share } = useShare();
  const { toast } = useToast();

  // Deferred metrics loading
  const delay = videoIndex < 3 ? 0 : Math.min(videoIndex * 50, 500);
  const { socialMetrics, userInteractions } = useDeferredVideoMetrics({
    videoId: video.id,
    videoPubkey: video.pubkey,
    vineId: video.vineId,
    userPubkey: user?.pubkey,
    delay,
    immediate: videoIndex < 3,
  });

  // Compute counts from video embedded + deferred delta
  const likeCount = (video.likeCount ?? 0) + (socialMetrics.data?.likeCount ?? 0);
  const repostCount = (video.repostCount ?? 0) + (socialMetrics.data?.repostCount ?? 0);
  const commentCount = (video.commentCount ?? 0) + (socialMetrics.data?.commentCount ?? 0);
  const isLiked = userInteractions.data?.hasLiked || false;
  const isReposted = userInteractions.data?.hasReposted || false;

  // --- Author data ---
  const authorData = useAuthor(video.pubkey, {
    initialName: video.authorName,
    initialAvatar: video.authorAvatar,
  });
  const author = enhanceAuthorData(authorData.data, video.pubkey);
  const badgesQuery = useBadges(video.pubkey);
  const rawMetadata = authorData.data?.metadata;
  const hasRealName = rawMetadata?.display_name || rawMetadata?.name;
  const displayName = hasRealName
    ? (rawMetadata.display_name || rawMetadata.name!)
    : (video.authorName || genUserName(video.pubkey));
  const profileImage = getSafeProfileImage(
    rawMetadata?.picture || video.authorAvatar || author.metadata.picture
  );
  const npub = nip19.npubEncode(video.pubkey);
  const profileUrl = `/${npub}`;

  // --- Detect classic Vine ---
  const isClassicVine = !!video.loopCount || video.isVineMigrated ||
    (video.originalVineTimestamp !== undefined && video.originalVineTimestamp < 1484611200);

  // --- Set active video ---
  useEffect(() => {
    if (isActive) {
      setActiveVideo(video.id);
    }
  }, [isActive, video.id, setActiveVideo]);

  // --- Action handlers ---
  const handleLike = useCallback(async () => {
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
      isCurrentlyLiked: isLiked,
      currentLikeEventId: userInteractions.data?.likeEventId || null,
    });
  }, [user, video.id, video.pubkey, video.vineId, isLiked, userInteractions.data?.likeEventId, openLoginDialog, toggleLike]);

  const handleRepost = useCallback(async () => {
    if (!user) {
      openLoginDialog();
      return;
    }
    if (!video.vineId) {
      toast({ title: 'Error', description: 'Cannot repost this video', variant: 'destructive' });
      return;
    }
    debugLog('Toggle repost for video:', video.id);
    await toggleRepost({
      videoId: video.id,
      videoPubkey: video.pubkey,
      vineId: video.vineId,
      userPubkey: user.pubkey,
      isCurrentlyReposted: isReposted,
      currentRepostEventId: userInteractions.data?.repostEventId || null,
    });
  }, [user, video.id, video.pubkey, video.vineId, isReposted, userInteractions.data?.repostEventId, openLoginDialog, toast, toggleRepost]);

  const handleShare = useCallback(() => {
    share(getVideoShareData(video));
  }, [share, video]);

  const handleDoubleTap = useCallback(() => {
    handleLike();
    setShowHeartAnimation(true);
    setTimeout(() => setShowHeartAnimation(false), 800);
  }, [handleLike]);

  const handleOpenComments = useCallback(() => {
    if (onOpenComments) {
      onOpenComments(video);
    } else {
      setShowComments(true);
    }
  }, [onOpenComments, video]);

  // --- Build badge text ---
  const badgeTexts: string[] = [];
  if (video.proofMode?.level === 'verified_mobile' || video.proofMode?.level === 'verified_web') {
    badgeTexts.push('Human-made');
  }
  if (!video.origin) {
    badgeTexts.push('Original');
  }
  if (isClassicVine) {
    badgeTexts.push('Classic Viner');
  }

  // Location from author profile (if available)
  const location = rawMetadata?.about ? undefined : undefined; // Location not reliably available

  return (
    <div
      className="h-[var(--feed-height)] w-full snap-start snap-always relative bg-black overflow-hidden"
    >
      {/* Video layer (z-0) */}
      <div className="absolute inset-0 z-0">
        {!videoError ? (
          <VideoPlayer
            videoId={video.id}
            src={video.videoUrl}
            hlsUrl={effectiveHlsUrl}
            fallbackUrls={video.fallbackVideoUrls}
            poster={video.thumbnailUrl}
            blurhash={video.blurhash}
            className="absolute inset-0 w-full h-full object-contain"
            onError={() => setVideoError(true)}
            onDoubleTap={handleDoubleTap}
            subtitleCues={subtitleCues}
            subtitlesVisible={showSubtitles}
            videoData={video}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white">
            <p>Failed to load video</p>
          </div>
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-black/40 via-black/20 via-[18%] to-transparent pointer-events-none z-[5]" />

      {/* Heart animation (z-20) */}
      {showHeartAnimation && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <Heart
            className="h-24 w-24 text-red-500 fill-current animate-ping"
            style={{ animationDuration: '0.6s' }}
          />
        </div>
      )}

      {/* Action column (right side, z-10) */}
      <div className="absolute right-2 bottom-[120px] z-10 flex flex-col items-center gap-4">
        {/* Like */}
        <button
          className="flex flex-col items-center gap-1"
          onClick={(e) => { e.stopPropagation(); handleLike(); }}
          aria-label={isLiked ? 'Unlike' : 'Like'}
        >
          <Heart className={cn(
            'w-8 h-8 text-white drop-shadow-lg',
            isLiked && 'text-red-500 fill-current'
          )} />
          <span className={cn(
            'text-[11px] font-semibold text-white drop-shadow-lg',
            isLiked && 'text-red-500'
          )}>
            {formatCount(likeCount)}
          </span>
        </button>

        {/* Comment */}
        <button
          className="flex flex-col items-center gap-1"
          onClick={(e) => { e.stopPropagation(); handleOpenComments(); }}
          aria-label="Comments"
        >
          <MessageCircle className="w-8 h-8 text-white drop-shadow-lg" />
          <span className="text-[11px] font-semibold text-white drop-shadow-lg">
            {formatCount(commentCount)}
          </span>
        </button>

        {/* Repost */}
        <button
          className="flex flex-col items-center gap-1"
          onClick={(e) => { e.stopPropagation(); handleRepost(); }}
          aria-label={isReposted ? 'Remove repost' : 'Repost'}
        >
          <Repeat2 className={cn(
            'w-8 h-8 text-white drop-shadow-lg',
            isReposted && 'text-green-500'
          )} />
          <span className={cn(
            'text-[11px] font-semibold text-white drop-shadow-lg',
            isReposted && 'text-green-500'
          )}>
            {formatCount(repostCount)}
          </span>
        </button>

        {/* Share */}
        <button
          className="flex flex-col items-center gap-1 p-2 rounded-[20px]"
          onClick={(e) => { e.stopPropagation(); handleShare(); }}
          aria-label="Share"
        >
          <Share2 className="w-8 h-8 text-white drop-shadow-lg" />
        </button>

        {/* More */}
        <button
          className="flex flex-col items-center gap-1 p-2 rounded-[20px]"
          onClick={(e) => { e.stopPropagation(); setShowMoreMenu(!showMoreMenu); }}
          aria-label="More options"
        >
          <ChevronDown className="w-8 h-8 text-white drop-shadow-lg" />
        </button>
      </div>

      {/* Author overlay (bottom-left, z-10) */}
      <div className="absolute bottom-4 left-4 right-16 z-10 flex flex-col gap-2">
        {/* Avatar + Username row */}
        <SmartLink
          to={profileUrl}
          ownerPubkey={video.pubkey}
          className="flex items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-12 rounded-[16px] border border-white/25 overflow-hidden flex-shrink-0">
            <img
              src={profileImage}
              alt={displayName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-['Bricolage_Grotesque'] font-extrabold text-sm text-white drop-shadow-lg truncate">
              {displayName}
            </span>
            {badgesQuery.data && badgesQuery.data.length > 0 && (
              <InlineBadges badges={badgesQuery.data} />
            )}
            <VideoVerificationBadgeRow video={video} />
          </div>
        </SmartLink>

        {/* Location byline */}
        {location && (
          <span className="text-[11px] font-semibold text-white/75 drop-shadow-lg">
            {location}
          </span>
        )}

        {/* Caption */}
        {(video.title || video.content) && (
          <div className="text-xs text-white leading-4 line-clamp-2 drop-shadow-lg">
            <NoteContent
              event={{
                id: video.id,
                pubkey: video.pubkey,
                created_at: video.createdAt,
                kind: 1,
                content: video.title || video.content || '',
                tags: [],
                sig: '',
              }}
              className="text-xs text-white"
            />
          </div>
        )}

        {/* Hashtags */}
        {video.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {video.hashtags.slice(0, 3).map((tag) => (
              <SmartLink
                key={tag}
                to={`/hashtag/${tag}`}
                className="text-xs text-[#00bf8f] drop-shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                #{tag}
              </SmartLink>
            ))}
            {video.hashtags.length > 3 && (
              <span className="text-xs text-white/60">+{video.hashtags.length - 3}</span>
            )}
          </div>
        )}

        {/* Badges row */}
        {badgeTexts.length > 0 && (
          <span className="text-[11px] font-semibold text-white/75 drop-shadow-lg">
            {badgeTexts.join(' \u00B7 ')}
          </span>
        )}
      </div>

      {/* Comments modal (fallback when no onOpenComments prop) */}
      <VideoCommentsModal
        video={video}
        open={showComments}
        onOpenChange={setShowComments}
      />
    </div>
  );
}
