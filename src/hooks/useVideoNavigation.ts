// ABOUTME: Hook for managing video navigation context and sequential browsing
// ABOUTME: Tracks video sources (hashtag, profile, discovery) and provides next/previous navigation

import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import { useVideoEvents } from './useVideoEvents';
import { usePeopleList } from '@/hooks/usePeopleLists';
import { usePeopleListVideos } from '@/hooks/usePeopleListVideos';
import { useFeedBlocklist } from '@/hooks/useFeedBlocklist';
import { useAppContext } from '@/hooks/useAppContext';
import { getEventLookupRelayUrls } from '@/config/relays';
import { filterBlockedVideos } from '@/lib/blocklistFilter';
import { matchesVideoRoute, matchesVideoTarget, type VideoRouteTarget } from '@/lib/videoRoute';
import type { AddressableCoordinate } from '@/lib/nostrCoordinates';
import { VIDEO_REFERENCE_KINDS, type ParsedVideoData } from '@/types/video';
import type { SortMode } from '@/types/nostr';

type WebSocketFeedType = 'discovery' | 'home' | 'trending' | 'hashtag' | 'profile' | 'recent' | 'classics' | 'category';

export interface VideoNavigationContext {
  source: 'hashtag' | 'profile' | 'discovery' | 'home' | 'trending' | 'popular' | 'recent' | 'classics' | 'foryou' | 'category' | 'search' | 'people-list' | 'video-list' | 'featured';
  hashtag?: string;
  pubkey?: string;
  listId?: string;
  featuredTabId?: string;
  listName?: string;
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
  routeTarget?: VideoRouteTarget;
  enabled?: boolean;
  context?: VideoNavigationContext | null;
  /**
   * The author and `d` tag an author-named route names. Without a feed
   * context, the video is then looked up by author and `d` tag instead of by
   * event id, and only that author's video counts as the current one.
   */
  address?: AddressableCoordinate | null;
}

export function useVideoNavigation(videoId: string, options: UseVideoNavigationOptions = {}): VideoNavigationHook {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { config } = useAppContext();
  const { enabled = true, context: contextOverride, address, routeTarget } = options;
  const relayUrls = useMemo(() => routeTarget?.relayHints?.length
    ? getEventLookupRelayUrls({
      configuredRelayUrls: [...(config.relayUrls ?? [config.relayUrl]), ...(config.customRelayUrls ?? [])],
      relayHints: routeTarget.relayHints,
      disabledRelayUrls: config.disabledPresetUrls,
    })
    : undefined, [config, routeTarget]);

  // Parse navigation context from URL params
  const parsedContext: VideoNavigationContext | null = useMemo(() => {
    return parseVideoNavigationContext(searchParams);
  }, [searchParams]);
  const context = contextOverride === undefined ? parsedContext : contextOverride;

  const isPeopleListContext = context?.source === 'people-list';
  const isVideoListContext = context?.source === 'video-list';
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
    if (isPeopleListContext || isVideoListContext) return 'discovery';
    if (context.source === 'foryou' || context.source === 'popular') return 'trending';
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
  const blockedPubkeys = useFeedBlocklist();
  const hasFeedContext = Boolean(context && !isPeopleListContext && !isVideoListContext);
  const { data: feedVideos, isLoading: feedVideosLoading } = useVideoEvents({
    feedType: feedTypeForWebSocket,
    hashtag: context?.hashtag,
    pubkey: context?.pubkey,
    limit: 50,
    enabled: enabled && hasFeedContext,
  });
  const navigationVideos = isPeopleListContext ? peopleListVideos : hasFeedContext ? feedVideos : undefined;
  const filteredNavigationVideos = useMemo(
    () => navigationVideos && filterBlockedVideos(navigationVideos, blockedPubkeys),
    [navigationVideos, blockedPubkeys],
  );

  const targetAddress = routeTarget?.address ?? address;
  const legacyAuthor = routeTarget?.legacyAuthor;
  const isTarget = (video: ParsedVideoData) => {
    if (routeTarget) return matchesVideoTarget(video, routeTarget);
    if (targetAddress) return matchesVideoRoute(video, targetAddress.dTag, targetAddress.pubkey);
    return video.id === videoId;
  };
  const navigationVideo = filteredNavigationVideos?.find(isTarget);
  const hasNavigationContext = hasFeedContext || isPeopleListContext;
  const hasExplicitTarget = Boolean(targetAddress || routeTarget?.eventId || legacyAuthor);
  const lookupDirect = enabled && (!hasNavigationContext || (hasExplicitTarget && !navigationVideo));
  const { data: directVideos, isLoading: directLoading } = useVideoEvents({
    ...(routeTarget && { acceptedKinds: VIDEO_REFERENCE_KINDS }),
    ...(relayUrls && { relayUrls }),
    filter: targetAddress
      ? { kinds: [targetAddress.kind], authors: [targetAddress.pubkey], '#d': [targetAddress.dTag] }
      : { ids: [videoId], ...(legacyAuthor && { authors: [legacyAuthor] }) },
    limit: 1,
    feedType: 'discovery',
    enabled: lookupDirect,
  });
  const { data: legacyAddressVideos, isLoading: legacyAddressLoading } = useVideoEvents({
    filter: { authors: legacyAuthor ? [legacyAuthor] : [], '#d': [videoId] },
    acceptedKinds: VIDEO_REFERENCE_KINDS,
    limit: 1,
    enabled: lookupDirect && Boolean(legacyAuthor),
  });
  const directVideo = lookupDirect ? filterBlockedVideos([
    ...(directVideos ?? []),
    ...(legacyAuthor ? legacyAddressVideos ?? [] : []),
  ], blockedPubkeys).find(isTarget) : undefined;
  const currentVideo = navigationVideo ?? directVideo ?? null;
  const videos = useMemo(() => {
    if (!directVideo || navigationVideo) return filteredNavigationVideos;
    return [...(filteredNavigationVideos ?? []), directVideo];
  }, [directVideo, filteredNavigationVideos, navigationVideo]);
  const navigationLoading = isPeopleListContext
    ? peopleListQuery.isLoading || peopleListVideosQuery.isLoading
    : feedVideosLoading;
  const isLoading = navigationLoading || (!currentVideo && lookupDirect && (
    directLoading || (Boolean(legacyAuthor) && legacyAddressLoading)
  ));
  const currentIndex = currentVideo ? videos?.indexOf(currentVideo) ?? -1 : -1;

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
    listName: searchParams.get('listName') || undefined,
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
  if (context.listName) params.set('listName', context.listName);
  if (context.query) params.set('q', context.query);
  if (context.sortMode) params.set('sort', context.sortMode);
  if (index !== undefined) params.set('index', index.toString());

  return `/video/${videoId}?${params.toString()}`;
}
