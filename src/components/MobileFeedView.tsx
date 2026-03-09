// ABOUTME: Snap-scroll mobile video feed for inline display below top bar and above bottom nav
// ABOUTME: Renders one video per viewport height with CSS scroll-snap for native momentum scrolling

import { useRef, useEffect, useState, useCallback } from 'react';
import { MobileVideoItem } from '@/components/MobileVideoItem';
import type { ParsedVideoData } from '@/types/video';

interface MobileFeedViewProps {
  videos: ParsedVideoData[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  onOpenComments?: (video: ParsedVideoData) => void;
}

export function MobileFeedView({
  videos,
  onLoadMore,
  hasMore,
  onOpenComments,
}: MobileFeedViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

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
      if (e.key === 'ArrowDown' || e.key === 'j') {
        if (currentIndex < videos.length - 1) {
          const target = containerRef.current?.children[currentIndex + 1] as HTMLElement;
          target?.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        if (currentIndex > 0) {
          const target = containerRef.current?.children[currentIndex - 1] as HTMLElement;
          target?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, videos.length]);

  return (
    <div
      ref={containerRef}
      className="h-[var(--feed-height)] w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      onScroll={handleScroll}
    >
      {videos.map((video, index) => (
        <MobileVideoItem
          key={video.id}
          video={video}
          isActive={index === currentIndex}
          onOpenComments={onOpenComments}
          videoIndex={index}
        />
      ))}
    </div>
  );
}
