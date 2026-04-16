import { useEffect, useMemo, useState } from 'react';
import { VideoPlayer } from '@/components/VideoPlayer';
import type { ParsedVideoData } from '@/types/video';

interface CompilationPlayerSurfaceProps {
  videos: ReadonlyArray<ParsedVideoData>;
  initialIndex: number;
  hasNextPage?: boolean;
  fetchNextPage?: () => void | Promise<unknown>;
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
  const [awaitingNextPage, setAwaitingNextPage] = useState(false);

  useEffect(() => {
    setCurrentIndex(boundedIndex);
    setAwaitingNextPage(false);
  }, [boundedIndex]);

  const currentVideo = useMemo(() => videos[currentIndex], [videos, currentIndex]);
  const preloadVideos = useMemo(
    () => videos.slice(currentIndex + 1, currentIndex + 3),
    [videos, currentIndex]
  );

  useEffect(() => {
    if (!currentVideo) {
      return;
    }

    onVideoChange?.(currentVideo);
  }, [currentVideo, onVideoChange]);

  useEffect(() => {
    if (!awaitingNextPage && hasNextPage && currentIndex >= videos.length - 2) {
      void fetchNextPage?.();
    }
  }, [awaitingNextPage, currentIndex, fetchNextPage, hasNextPage, videos.length]);

  useEffect(() => {
    if (!awaitingNextPage || currentIndex >= videos.length - 1) {
      return;
    }

    const nextVideo = videos[currentIndex + 1];
    if (!nextVideo) {
      return;
    }

    setCurrentIndex(index => index + 1);
    setAwaitingNextPage(false);
    replaceVideoQueryParam?.(nextVideo.id);
  }, [awaitingNextPage, currentIndex, replaceVideoQueryParam, videos]);

  if (!currentVideo) {
    return null;
  }

  const handleEnded = () => {
    if (currentIndex >= videos.length - 1) {
      if (hasNextPage && !awaitingNextPage) {
        setAwaitingNextPage(true);
        void fetchNextPage?.();
      }
      return;
    }

    const nextVideo = videos[currentIndex + 1];
    setCurrentIndex(index => index + 1);
    setAwaitingNextPage(false);
    replaceVideoQueryParam?.(nextVideo.id);
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
      {preloadVideos.map((video) => (
        <video
          key={video.id}
          data-testid={`compilation-preload-video-${video.id}`}
          src={video.videoUrl}
          preload="auto"
          muted
          playsInline
          className="hidden"
        />
      ))}
      <div className="text-sm font-medium">{currentVideo.title ?? currentVideo.id}</div>
    </div>
  );
}

export default CompilationPlayerSurface;
