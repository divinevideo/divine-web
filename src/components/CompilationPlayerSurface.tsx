import { useEffect, useMemo, useState } from 'react';
import { VideoPlayer } from '@/components/VideoPlayer';
import type { ParsedVideoData } from '@/types/video';

interface CompilationPlayerSurfaceProps {
  videos: ParsedVideoData[];
  initialIndex: number;
  hasNextPage?: boolean;
  fetchNextPage?: () => void | Promise<void>;
  onVideoChange?: (video: ParsedVideoData) => void;
  replaceVideoQueryParam?: (videoId: string) => void;
}

export function CompilationPlayerSurface({
  videos,
  initialIndex,
  hasNextPage = false,
  fetchNextPage,
  onVideoChange,
  replaceVideoQueryParam,
}: CompilationPlayerSurfaceProps) {
  const boundedIndex = Math.min(Math.max(initialIndex, 0), Math.max(videos.length - 1, 0));
  const [currentIndex, setCurrentIndex] = useState(boundedIndex);

  useEffect(() => {
    setCurrentIndex(boundedIndex);
  }, [boundedIndex]);

  const currentVideo = useMemo(() => videos[currentIndex], [videos, currentIndex]);

  useEffect(() => {
    if (!currentVideo) {
      return;
    }

    onVideoChange?.(currentVideo);
  }, [currentVideo, onVideoChange]);

  useEffect(() => {
    if (hasNextPage && currentIndex >= videos.length - 2) {
      void fetchNextPage?.();
    }
  }, [currentIndex, fetchNextPage, hasNextPage, videos.length]);

  if (!currentVideo) {
    return null;
  }

  const handleEnded = () => {
    if (currentIndex >= videos.length - 1) {
      return;
    }

    const nextVideo = videos[currentIndex + 1];
    setCurrentIndex(index => index + 1);
    replaceVideoQueryParam?.(nextVideo.id);
    onVideoChange?.(nextVideo);
  };

  return (
    <div className="space-y-3">
      <VideoPlayer
        key={currentVideo.id}
        videoId={currentVideo.id}
        src={currentVideo.videoUrl}
        hlsUrl={currentVideo.hlsUrl}
        fallbackUrls={currentVideo.fallbackVideoUrls}
        poster={currentVideo.thumbnailUrl}
        blurhash={currentVideo.blurhash}
        onEnded={handleEnded}
        preload="auto"
        videoData={currentVideo}
      />
      <div className="text-sm font-medium">{currentVideo.title ?? currentVideo.id}</div>
    </div>
  );
}

export default CompilationPlayerSurface;
