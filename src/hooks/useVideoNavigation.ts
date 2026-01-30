// ABOUTME: Hook for managing video navigation context and sequential browsing
// ABOUTME: Tracks video sources (hashtag, profile, discovery) and provides next/previous navigation

import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import { useVideoEvents } from './useVideoEvents';
import type { ParsedVideoData } from '@/types/video';

export interface VideoNavigationContext {
  source: 'hashtag' | 'profile' | 'discovery' | 'home' | 'trending' | 'recent' | 'classics' | 'foryou';
  hashtag?: string;
  pubkey?: string;
  currentIndex?: number;
}

interface VideoNavigationHook {
  context: VideoNavigationContext | null;
  videos: ParsedVideoData[] | undefined;
  currentVideo: ParsedVideoData | null;
  hasNext: boolean;
  hasPrevious: boolean;
  goToNext: () => void;
  goToPrevious: () => void;
  isLoading: boolean;
}

export function useVideoNavigation(videoId: string): VideoNavigationHook {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Parse navigation context from URL params
  const context: VideoNavigationContext | null = useMemo(() => {
    const source = searchParams.get('source') as VideoNavigationContext['source'];
    if (!source) return null;

    return {
      source,
      hashtag: searchParams.get('hashtag') || undefined,
      pubkey: searchParams.get('pubkey') || undefined,
      currentIndex: searchParams.get('index') ? parseInt(searchParams.get('index')!) : undefined,
    };
  }, [searchParams]);

  // Fetch videos based on context
  // Map 'foryou' to 'trending' for WebSocket fallback (foryou only works via Funnelcake API)
  const feedTypeForWebSocket = context?.source === 'foryou' ? 'trending' : context?.source;
  const { data: videos, isLoading } = useVideoEvents(
    context ? {
      feedType: feedTypeForWebSocket,
      hashtag: context.hashtag,
      pubkey: context.pubkey,
      limit: 50, // Get enough videos for navigation
    } : {
      filter: { ids: [videoId] },
      limit: 1,
      feedType: 'discovery',
    }
  );

  // Find current video and its index
  const { currentVideo, currentIndex } = useMemo(() => {
    if (!videos) return { currentVideo: null, currentIndex: -1 };

    const index = videos.findIndex(video => video.id === videoId);
    return {
      currentVideo: index >= 0 ? videos[index] : null,
      currentIndex: index,
    };
  }, [videos, videoId]);

  // Navigation helpers
  const hasNext = currentIndex >= 0 && currentIndex < (videos?.length || 0) - 1;
  const hasPrevious = currentIndex > 0;

  const buildNavigationUrl = useCallback((video: ParsedVideoData, index: number) => {
    if (!context) return `/video/${video.id}`;

    const params = new URLSearchParams({
      source: context.source,
      index: index.toString(),
    });

    if (context.hashtag) params.set('hashtag', context.hashtag);
    if (context.pubkey) params.set('pubkey', context.pubkey);

    return `/video/${video.id}?${params.toString()}`;
  }, [context]);

  const goToNext = useCallback(() => {
    if (!hasNext || !videos) return;
    const nextVideo = videos[currentIndex + 1];
    navigate(buildNavigationUrl(nextVideo, currentIndex + 1));
  }, [hasNext, videos, currentIndex, navigate, buildNavigationUrl]);

  const goToPrevious = useCallback(() => {
    if (!hasPrevious || !videos) return;
    const prevVideo = videos[currentIndex - 1];
    navigate(buildNavigationUrl(prevVideo, currentIndex - 1));
  }, [hasPrevious, videos, currentIndex, navigate, buildNavigationUrl]);

  return {
    context,
    videos,
    currentVideo,
    hasNext,
    hasPrevious,
    goToNext,
    goToPrevious,
    isLoading,
  };
}

// Helper function to build navigation URL from context
export function buildVideoNavigationUrl(
  videoId: string,
  context: VideoNavigationContext,
  index?: number
): string {
  const params = new URLSearchParams({
    source: context.source,
  });

  if (context.hashtag) params.set('hashtag', context.hashtag);
  if (context.pubkey) params.set('pubkey', context.pubkey);
  if (index !== undefined) params.set('index', index.toString());

  return `/video/${videoId}?${params.toString()}`;
}