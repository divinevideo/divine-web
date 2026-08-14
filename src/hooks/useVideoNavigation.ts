// ABOUTME: Hook for managing video navigation context and sequential browsing
// ABOUTME: Tracks video sources (hashtag, profile, discovery) and provides next/previous navigation

import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import { useVideoEvents } from './useVideoEvents';
import { usePeopleList } from '@/hooks/usePeopleLists';
import { usePeopleListVideos } from '@/hooks/usePeopleListVideos';
import type { ParsedVideoData } from '@/types/video';
import type { SortMode } from '@/types/nostr';

type WebSocketFeedType = 'discovery' | 'home' | 'trending' | 'hashtag' | 'profile' | 'recent' | 'classics' | 'category';

export interface VideoNavigationContext {
  source: 'hashtag' | 'profile' | 'discovery' | 'home' | 'trending' | 'popular' | 'recent' | 'classics' | 'foryou' | 'category' | 'search' | 'people-list' | 'featured';
  hashtag?: string;
  pubkey?: string;
  listId?: string;
  featuredTabId?: string;
  query?: string;
  sortMode?: SortMode | 'relevance';
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

interface UseVideoNavigationOptions {
  enabled?: boolean;
}

export function useVideoNavigation(videoId: string, options: UseVideoNavigationOptions = {}): VideoNavigationHook {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { enabled = true } = options;

  // Parse navigation context from URL params
  const context: VideoNavigationContext | null = useMemo(() => {
    return parseVideoNavigationContext(searchParams);
  }, [searchParams]);

  const isPeopleListContext = context?.source === 'people-list';
  const peopleListQuery = usePeopleList(
    isPeopleListContext ? context.pubkey : undefined,
    isPeopleListContext ? context.listId : undefined,
  );
  const peopleListVideosQuery = usePeopleListVideos(
    isPeopleListContext ? peopleListQuery.data?.memberPubkeys ?? [] : [],
    { enabled: enabled && isPeopleListContext && Boolean(peopleListQuery.data) },
  );
  const peopleListVideos = useMemo(
    () => peopleListVideosQuery.data?.pages.flatMap((page) => page.videos),
    [peopleListVideosQuery.data],
  );

  // Fetch videos based on context
  // Map 'foryou' to 'trending' for WebSocket fallback (foryou only works via Funnelcake API)
  const feedTypeForWebSocket: WebSocketFeedType | undefined = (() => {
    if (!context) return undefined;
    if (isPeopleListContext) return 'discovery';
    if (context.source === 'foryou' || context.source === 'popular' || context.source === 'featured') return 'trending';
    if (context.source === 'search') return 'discovery';
    if (
      context.source === 'hashtag' ||
      context.source === 'profile' ||
      context.source === 'discovery' ||
      context.source === 'home' ||
      context.source === 'trending' ||
      context.source === 'recent' ||
      context.source === 'classics' ||
      context.source === 'category'
    ) {
      return context.source;
    }
    return 'discovery';
  })();
  const { data: feedVideos, isLoading: feedVideosLoading } = useVideoEvents(
    context && !isPeopleListContext && feedTypeForWebSocket ? {
      feedType: feedTypeForWebSocket,
      hashtag: context.hashtag,
      pubkey: context.pubkey,
      limit: 50, // Get enough videos for navigation
      enabled,
    } : {
      filter: { ids: [videoId] },
      limit: 1,
      feedType: 'discovery',
      enabled: enabled && !isPeopleListContext,
    }
  );
  const videos = isPeopleListContext ? peopleListVideos : feedVideos;
  const isLoading = isPeopleListContext
    ? peopleListQuery.isLoading || peopleListVideosQuery.isLoading
    : feedVideosLoading;

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

    return buildVideoNavigationUrl(video.id, context, index);
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

export function parseVideoNavigationContext(searchParams: URLSearchParams): VideoNavigationContext | null {
  const source = searchParams.get('source') as VideoNavigationContext['source'];
  if (!source) return null;

  const rawIndex = searchParams.get('index');
  const sortMode = searchParams.get('sort') as VideoNavigationContext['sortMode'] | null;
  const currentIndex = rawIndex ? parseInt(rawIndex, 10) : undefined;

  return {
    source,
    hashtag: searchParams.get('hashtag') || undefined,
    pubkey: searchParams.get('pubkey') || undefined,
    listId: searchParams.get('listId') || undefined,
    featuredTabId: searchParams.get('featuredTabId') || undefined,
    query: searchParams.get('q') || undefined,
    sortMode: sortMode || undefined,
    currentIndex: Number.isFinite(currentIndex) ? currentIndex : undefined,
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
  if (context.listId) params.set('listId', context.listId);
  if (context.featuredTabId) params.set('featuredTabId', context.featuredTabId);
  if (context.query) params.set('q', context.query);
  if (context.sortMode) params.set('sort', context.sortMode);
  if (index !== undefined) params.set('index', index.toString());

  return `/video/${videoId}?${params.toString()}`;
}
