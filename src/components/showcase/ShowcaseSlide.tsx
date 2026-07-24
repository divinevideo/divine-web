// ABOUTME: One video in the phone-frame showcase reel — read-only, share only
// ABOUTME: Autoplays muted+looping when active; no like/follow/comment affordances

import { useEffect, useRef, useState } from 'react';
import { ShareNetwork, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { useAuthor } from '@/hooks/useAuthor';
import { resolveDisplayName } from '@/lib/showcaseDisplayName';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { parseAspectRatio, pickObjectFit } from '@/lib/showcaseVideoFit';
import type { ParsedVideoData } from '@/types/video';

interface ShowcaseSlideProps {
  video: ParsedVideoData;
  isActive: boolean;
  /** Shared across the reel so unmuting persists as you swipe. */
  muted: boolean;
  onToggleMute: () => void;
  onShare: (video: ParsedVideoData) => void;
  /** Tap the top of the screen for the previous video. */
  onTapPrev: () => void;
  /** Tap the bottom of the screen for the next video. */
  onTapNext: () => void;
}

export function ShowcaseSlide({
  video,
  isActive,
  muted,
  onToggleMute,
  onShare,
  onTapPrev,
  onTapNext,
}: ShowcaseSlideProps) {
  const author = useAuthor(video.pubkey);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Preserve the aspect ratio of square classics: they'd be badly cropped by
  // object-cover in the tall frame, so letterbox them. Seed from the imeta `dim`
  // tag for the right fit before playback, then confirm from the real video
  // dimensions once metadata loads.
  const [objectFit, setObjectFit] = useState<'cover' | 'contain'>(() =>
    pickObjectFit(parseAspectRatio(video.dimensions)),
  );

  const handleLoadedMetadata = () => {
    const el = videoRef.current;
    if (el?.videoWidth && el.videoHeight) {
      setObjectFit(pickObjectFit(el.videoWidth / el.videoHeight));
    }
  };

  const metadata = author.data?.metadata;
  const displayName = resolveDisplayName(metadata, video.pubkey, video.authorName);
  const avatar = getSafeProfileImage(metadata?.picture ?? video.authorAvatar);

  // The reel's videos title their clip; the event `content` is usually empty and
  // occasionally repeats the title, so only show it as a description when it adds
  // something.
  const description =
    video.content && video.content.trim() && video.content.trim() !== video.title?.trim()
      ? video.content.trim()
      : null;

  // Only the slide currently snapped into view plays. Others pause and rewind so
  // scrolling back restarts them cleanly and only one video decodes at a time.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      el.play().catch(() => {
        // Autoplay can be refused; the poster frame stays up, which is fine.
      });
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [isActive]);

  // React doesn't reliably reflect the `muted` prop to the DOM property after
  // the initial render, so drive it imperatively. Starting muted is what lets
  // the reel autoplay; unmuting happens only after the user taps the toggle
  // (a gesture), so sound is permitted from then on.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  return (
    <div className="relative h-full w-full snap-start snap-always bg-black">
      <video
        ref={videoRef}
        src={video.videoUrl}
        poster={video.thumbnailUrl}
        muted={muted}
        loop
        playsInline
        preload={isActive ? 'auto' : 'none'}
        onLoadedMetadata={handleLoadedMetadata}
        className={`h-full w-full ${objectFit === 'contain' ? 'object-contain' : 'object-cover'}`}
      />

      {/* Invisible tap zones: top half → previous, bottom half → next, like the
          app. These sit above the video but BELOW the caption and share button
          (which have higher z-index), so those stay tappable. A tap fires the
          click; a drag scrolls the reel, so swiping still works. Arrow keys on
          the reel cover keyboard users, so these are hidden from a11y. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onTapPrev}
        className="absolute inset-x-0 top-0 z-10 h-1/2 w-full cursor-default focus:outline-none"
      />
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onTapNext}
        className="absolute inset-x-0 bottom-0 z-10 h-1/2 w-full cursor-default focus:outline-none"
      />

      {/* Read-only caption: creator, title, optional description — on a flat
          translucent panel so it stays legible over any frame. (Brand rules
          forbid gradient scrims on layout surfaces, so this is a solid blurred
          block rather than a fade.) No interactive engagement controls. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3">
        <div className="rounded-2xl bg-black/50 p-3 text-white backdrop-blur-md">
          <div className="flex items-center gap-2">
            {avatar && (
              <img
                src={avatar}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full object-cover ring-2 ring-white/60"
                loading="lazy"
              />
            )}
            <span className="min-w-0 truncate text-sm font-semibold tracking-tight">
              {displayName}
            </span>
          </div>
          {video.title && (
            <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-snug text-white">
              {video.title}
            </p>
          )}
          {description && (
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-white/70">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Controls, grouped top-right above the tap zones. */}
      <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute video' : 'Mute video'}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65"
        >
          {muted ? (
            <SpeakerSlash className="h-5 w-5" weight="bold" />
          ) : (
            <SpeakerHigh className="h-5 w-5" weight="bold" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onShare(video)}
          aria-label="Share this video"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65"
        >
          <ShareNetwork className="h-5 w-5" weight="bold" />
        </button>
      </div>
    </div>
  );
}
