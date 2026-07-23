// ABOUTME: Snap-scroll mobile video feed for inline display below top bar and above bottom nav
// ABOUTME: Renders one video per viewport height with CSS scroll-snap for native momentum scrolling

import { useRef, useEffect, useState, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { MobileVideoItem } from '@/components/MobileVideoItem';
import { cn } from '@/lib/utils';
import type { ParsedVideoData } from '@/types/video';

interface MobileFeedViewProps {
  videos: ParsedVideoData[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  onOpenComments?: (video: ParsedVideoData) => void;
  transparentTopBar?: boolean;
}

const WINDOW_BACK = 2;
const WINDOW_FORWARD = 3;

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}

export function MobileFeedView({
  videos,
  onLoadMore,
  hasMore,
  onOpenComments,
  transparentTopBar = false,
}: MobileFeedViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const feedStyle = transparentTopBar
    ? ({ '--feed-height': 'calc(100dvh - var(--bottom-nav-height))' } as CSSProperties)
    : undefined;

  const shouldRenderVideo = useCallback((index: number) => {
    return index >= currentIndex - WINDOW_BACK && index <= currentIndex + WINDOW_FORWARD;
  }, [currentIndex]);

  // Track which video is most visible based on scroll position
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / itemHeight);

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < videos.length) {
      setCurrentIndex(newIndex);

      // Load more when near end
      if (hasMore && onLoadMore && newIndex >= videos.length - 3) {
        onLoadMore();
      }
    }
  }, [currentIndex, videos.length, hasMore, onLoadMore]);

  // Keyboard navigation: ArrowDown/j = next, ArrowUp/k = previous
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        if (currentIndex < videos.length - 1) {
          e.preventDefault();
          const target = containerRef.current?.children[currentIndex + 1] as HTMLElement;
          target?.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        if (currentIndex > 0) {
          e.preventDefault();
          const target = containerRef.current?.children[currentIndex - 1] as HTMLElement;
          target?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, videos.length]);

  const feed = (
    <div
      ref={containerRef}
      className={cn(
        'lg:hidden fixed inset-x-0 bottom-[var(--bottom-nav-height)] z-30 w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide bg-black',
        transparentTopBar ? 'top-0' : 'top-[var(--top-bar-height)]'
      )}
      style={feedStyle}
      onScroll={handleScroll}
    >
      {videos.map((video, index) => (
        <div
          key={video.id}
          className="h-[var(--feed-height)] w-full snap-start snap-always bg-black"
          aria-hidden={!shouldRenderVideo(index) ? true : undefined}
        >
          {shouldRenderVideo(index) && (
            <MobileVideoItem
              video={video}
              isActive={index === currentIndex}
              onOpenComments={onOpenComments}
              videoIndex={index}
            />
          )}
        </div>
      ))}
    </div>
  );

  if (typeof document === 'undefined') {
    return feed;
  }

  return createPortal(feed, document.body);
}
