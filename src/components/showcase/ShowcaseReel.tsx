// ABOUTME: Vertical scroll-snap reel of curated videos, framed like a phone
// ABOUTME: Tap top/bottom or arrow-key through it in a loop; read-only, share only

import { useCallback, useEffect, useRef, useState } from 'react';
import { useShowcaseShare } from '@/hooks/useShowcaseShare';
import { getVideoShareData } from '@/lib/shareUtils';
import { ShowcaseSlide } from '@/components/showcase/ShowcaseSlide';
import { isWrap, wrapIndex } from '@/lib/wrapIndex';
import type { ParsedVideoData } from '@/types/video';

interface ShowcaseReelProps {
  videos: ParsedVideoData[];
}

export function ShowcaseReel({ videos }: ShowcaseReelProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  // One mute state for the whole reel: starts muted (required for autoplay),
  // and once the viewer unmutes it stays that way as they swipe.
  const [muted, setMuted] = useState(true);
  const share = useShowcaseShare();

  const onToggleMute = useCallback(() => setMuted((m) => !m), []);

  const onShare = useCallback(
    (video: ParsedVideoData) => share(getVideoShareData(video)),
    [share],
  );

  // The slide occupying most of the viewport is the "active" one that plays.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) setActiveIndex(idx);
          }
        }
      },
      { root: scroller, threshold: [0.6] },
    );

    for (const el of slideRefs.current) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [videos.length]);

  // Step the reel by a number of slides, looping past either end.
  //
  // The current slide comes from the scroller's own scrollTop rather than from
  // `activeIndex`: that state is set by an IntersectionObserver callback, so it
  // trails the actual scroll position by a frame or more. Reading it here meant
  // a second tap landing before the observer caught up computed its target from
  // a stale index and jumped to the wrong clip. Scroll position is authoritative
  // and always current.
  const stepSlides = useCallback(
    (delta: number) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const count = videos.length;
      if (count === 0) return;

      const current = Math.round(scroller.scrollTop / scroller.clientHeight);
      const requested = current + delta;
      // Scroll the reel container itself rather than scrollIntoView(), which would
      // also scroll every ancestor — including the window — and shove the whole
      // page up so the phone's top clips under the header. Each slide is exactly
      // the scroller's height, so slide N sits at N × clientHeight.
      //
      // A wrap jumps instantly instead of animating: smooth-scrolling from the
      // last slide back to the first would rewind through every clip in between,
      // which reads as a glitch rather than a loop.
      scroller.scrollTo({
        top: wrapIndex(requested, count) * scroller.clientHeight,
        behavior: isWrap(requested, count) ? 'auto' : 'smooth',
      });
    },
    [videos.length],
  );

  // Arrow keys page the reel when it (or a child) holds focus — the keyboard
  // equivalent of the tap zones.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        stepSlides(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        stepSlides(-1);
      }
    },
    [stepSlides],
  );

  return (
    <div className="relative h-full w-full">
      <div
        ref={scrollerRef}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="group"
        aria-label="Curated video reel"
        className="hide-scrollbar h-full w-full snap-y snap-mandatory overflow-y-auto focus:outline-none"
      >
        {videos.map((video, index) => (
          <div
            key={`${video.pubkey}:${video.vineId ?? video.id}`}
            ref={(el) => { slideRefs.current[index] = el; }}
            data-index={index}
            className="h-full w-full"
          >
            <ShowcaseSlide
              video={video}
              isActive={index === activeIndex}
              muted={muted}
              onToggleMute={onToggleMute}
              onShare={onShare}
              onTapPrev={() => stepSlides(-1)}
              onTapNext={() => stepSlides(1)}
            />
          </div>
        ))}
      </div>

      {/* Divine wordmark watermark, top-left, in white like the in-app overlay.
          The source SVG is the brand-green wordmark; `brightness-0 invert`
          recolors it to solid white without needing a separate asset.
          Pointer-events-none so it never intercepts a tap; drop shadow keeps it
          legible over a light video frame. */}
      <img
        src="/divine-logo.svg"
        alt="Divine"
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-3 z-30 h-5 opacity-95 brightness-0 invert drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
      />

      {/* Progress dots — which video of how many. Non-interactive. */}
      <div aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 hidden -translate-y-1/2 flex-col gap-1.5 sm:flex">
        {videos.map((_, index) => (
          <span
            key={index}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${index === activeIndex ? 'bg-white' : 'bg-white/40'}`}
          />
        ))}
      </div>
    </div>
  );
}
