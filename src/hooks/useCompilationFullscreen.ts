import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFullscreenFeed } from '@/contexts/FullscreenFeedContext';
import {
  getCompilationStartIndex,
  parseCompilationPlaybackParams,
} from '@/lib/compilationPlayback';
import type { ParsedVideoData } from '@/types/video';

interface UseCompilationFullscreenOptions {
  videos: ReadonlyArray<ParsedVideoData>;
  fetchNextPage?: () => void | Promise<unknown>;
  hasNextPage?: boolean;
  enabled?: boolean;
}

export function useCompilationFullscreen({
  videos,
  fetchNextPage,
  hasNextPage = false,
  enabled = true,
}: UseCompilationFullscreenOptions) {
  const [searchParams] = useSearchParams();
  const request = useMemo(
    () => parseCompilationPlaybackParams(searchParams),
    [searchParams]
  );
  const { setVideosForFullscreen, updateVideos, enterFullscreen } = useFullscreenFeed();
  const hasOpenedRef = useRef(false);
  const isFetchingRequestedVideoRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    setVideosForFullscreen([...videos], fetchNextPage, hasNextPage);
  }, [enabled, fetchNextPage, hasNextPage, setVideosForFullscreen, videos]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    updateVideos([...videos]);
  }, [enabled, updateVideos, videos]);

  useEffect(() => {
    if (!enabled || !request.play) {
      hasOpenedRef.current = false;
      isFetchingRequestedVideoRef.current = false;
      return;
    }

    if (videos.length === 0) {
      return;
    }

    const startIndex = getCompilationStartIndex(request, videos);
    if (request.videoId && startIndex < 0) {
      if (hasNextPage && !isFetchingRequestedVideoRef.current) {
        isFetchingRequestedVideoRef.current = true;
        void fetchNextPage?.();
      }
      return;
    }

    isFetchingRequestedVideoRef.current = false;
    if (hasOpenedRef.current) {
      return;
    }

    enterFullscreen([...videos], Math.max(startIndex, 0));
    hasOpenedRef.current = true;
  }, [enabled, enterFullscreen, fetchNextPage, hasNextPage, request, videos]);
}
