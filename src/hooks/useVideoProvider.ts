// ABOUTME: Unified video provider hook that selects between Funnelcake and WebSocket
// ABOUTME: Uses an explicit support matrix so unsupported feeds never collapse into generic queries

import { useAppContext } from '@/hooks/useAppContext';
import { useInfiniteVideos } from '@/hooks/useInfiniteVideos';
import { useResolvedRelayCapabilities } from '@/hooks/useRelayCapabilities';
import { useInfiniteVideosFunnelcake, type FunnelcakeFeedType, type FunnelcakeSortMode } from '@/hooks/useInfiniteVideosFunnelcake';
import { hasFunnelcake, getFunnelcakeUrl, DEFAULT_FUNNELCAKE_URL } from '@/config/relays';
import { debugLog } from '@/lib/debug';
import type { RelayCapabilities } from '@/lib/relayCapabilities';
import type { SortMode } from '@/types/nostr';

// Feed types that can be provided
export type VideoFeedType = 'discovery' | 'home' | 'trending' | 'hashtag' | 'profile' | 'recent' | 'classics' | 'foryou' | 'category';
type WebsocketVideoFeedType = 'discovery' | 'home' | 'trending' | 'hashtag' | 'profile' | 'recent';

interface UseVideoProviderOptions {
  feedType: VideoFeedType;
  sortMode?: SortMode;
  hashtag?: string;
  category?: string;
  pubkey?: string;
  pageSize?: number;
  enabled?: boolean;
}

interface VideoProviderResult {
  data: ReturnType<typeof useInfiniteVideos>['data'];
  fetchNextPage: () => void;
  hasNextPage: boolean | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  // Additional metadata
  dataSource: 'funnelcake' | 'websocket';
  apiUrl?: string;
}

interface VideoSourceDecision {
  dataSource: 'funnelcake' | 'websocket';
  apiUrl?: string;
  websocketFeedType?: WebsocketVideoFeedType;
  reason: string;
}

function canServeFeedViaFunnelcake(feedType: VideoFeedType): boolean {
  switch (feedType) {
    case 'discovery':
    case 'home':
    case 'trending':
    case 'hashtag':
    case 'profile':
    case 'recent':
    case 'classics':
    case 'foryou':
    case 'category':
      return true;
  }
}

/**
 * Map VideoFeedType to FunnelcakeFeedType
 */
function mapToFunnelcakeFeedType(feedType: VideoFeedType): FunnelcakeFeedType {
  switch (feedType) {
    case 'discovery':
      return 'trending';
    case 'classics':
      return 'classics';
    case 'trending':
      return 'trending';
    case 'recent':
      return 'recent';
    case 'hashtag':
      return 'hashtag';
    case 'profile':
      return 'profile';
    case 'home':
      return 'home';
    case 'foryou':
      return 'recommendations';
    case 'category':
      return 'category';
    default:
      return 'trending';
  }
}

function mapToWebsocketFeedType(feedType: VideoFeedType): WebsocketVideoFeedType | null {
  switch (feedType) {
    case 'discovery':
    case 'home':
    case 'trending':
    case 'hashtag':
    case 'profile':
    case 'recent':
      return feedType;
    default:
      return null;
  }
}

/**
 * Map SortMode to FunnelcakeSortMode
 */
function mapToFunnelcakeSortMode(sortMode?: SortMode): FunnelcakeSortMode | undefined {
  if (!sortMode) return undefined;

  switch (sortMode) {
    case 'hot':
      return 'trending';
    case 'top':
      return 'loops';
    case 'rising':
      return 'engagement';
    case 'controversial':
      return 'engagement';
    case 'classic':
      return 'classic';
    default:
      return 'trending';
  }
}

export function canServeFeedViaWebsocket(
  feedType: VideoFeedType,
  sortMode: SortMode | undefined,
  capabilities: Pick<RelayCapabilities, 'supportsVideoSorts'>
): boolean {
  switch (feedType) {
    case 'classics':
    case 'foryou':
    case 'category':
      return false;

    case 'discovery':
    case 'trending':
      return !sortMode || capabilities.supportsVideoSorts;

    case 'recent':
    case 'hashtag':
    case 'profile':
    case 'home':
      return true;
  }
}

export function chooseVideoDataSource({
  feedType,
  sortMode,
  relayUrl,
  relayCapabilities,
}: {
  feedType: VideoFeedType;
  sortMode?: SortMode;
  relayUrl: string;
  relayCapabilities: RelayCapabilities;
}): VideoSourceDecision {
  const relayHasFunnelcake = hasFunnelcake(relayUrl);
  const relayFunnelcakeUrl = getFunnelcakeUrl(relayUrl) || undefined;
  const websocketFeedType = mapToWebsocketFeedType(feedType);
  const websocketSupported = websocketFeedType
    ? canServeFeedViaWebsocket(feedType, sortMode, relayCapabilities)
    : false;
  const apiUrl = relayFunnelcakeUrl || DEFAULT_FUNNELCAKE_URL;

  // Feed reads prefer Funnelcake REST. Keep a websocket route available as a
  // recovery path for feeds the selected relay can still serve directly.
  if (canServeFeedViaFunnelcake(feedType) && apiUrl) {
    return {
      dataSource: 'funnelcake',
      apiUrl,
      websocketFeedType: websocketSupported ? (websocketFeedType ?? undefined) : undefined,
      reason: relayHasFunnelcake
        ? 'prefer-selected-relay-funnelcake-rest-api'
        : 'prefer-canonical-funnelcake-rest-api',
    };
  }

  if (websocketFeedType && websocketSupported) {
    return {
      dataSource: 'websocket',
      websocketFeedType,
      reason: 'relay-websocket-supports-feed',
    };
  }

  return {
    dataSource: 'websocket',
    websocketFeedType: websocketFeedType || 'recent',
    reason: 'websocket-last-resort',
  };
}

/**
 * Unified video provider hook
 *
 * Automatically selects the best data source:
 * 1. Prefer Funnelcake REST for feed reads
 * 2. Use the selected relay's Funnelcake host when available
 * 3. Fall back to Divine's canonical Funnelcake when the selected relay has no REST endpoint
 * 4. Only use WebSocket after a Funnelcake failure
 *
 * The hook exposes `dataSource` to indicate which backend is being used.
 */
export function useVideoProvider({
  feedType,
  sortMode,
  hashtag,
  category,
  pubkey,
  pageSize = 12,
  enabled = true,
}: UseVideoProviderOptions): VideoProviderResult {
  const { config } = useAppContext();
  const relayUrl = config.relayUrl;
  const relayCapabilities = useResolvedRelayCapabilities(relayUrl);

  const decision = chooseVideoDataSource({
    feedType,
    sortMode,
    relayUrl,
    relayCapabilities,
  });

  const shouldUseFunnelcake = decision.dataSource === 'funnelcake';

  debugLog(`[useVideoProvider] Feed: ${feedType}, Relay: ${relayUrl}, Source: ${decision.dataSource}, Reason: ${decision.reason}`);

  // Funnelcake query (enabled only when shouldUseFunnelcake is true)
  const funnelcakeQuery = useInfiniteVideosFunnelcake({
    feedType: mapToFunnelcakeFeedType(feedType),
    apiUrl: decision.apiUrl,
    sortMode: mapToFunnelcakeSortMode(sortMode),
    hashtag,
    category,
    pubkey,
    pageSize,
    enabled: enabled && shouldUseFunnelcake,
    randomizeWithinTop: feedType === 'classics' ? 500 : undefined,
  });

  const shouldEnableWebsocket =
    enabled &&
    !!decision.websocketFeedType &&
    (!shouldUseFunnelcake || !!funnelcakeQuery.error);

  const websocketQuery = useInfiniteVideos({
    feedType: decision.websocketFeedType || 'recent',
    sortMode,
    hashtag,
    pubkey,
    pageSize,
    enabled: shouldEnableWebsocket,
  });

  const usingWebsocketFallback = shouldUseFunnelcake && !!funnelcakeQuery.error && !!decision.websocketFeedType;
  const activeQuery = usingWebsocketFallback
    ? websocketQuery
    : (shouldUseFunnelcake ? funnelcakeQuery : websocketQuery);
  const activeDataSource = usingWebsocketFallback
    ? 'websocket'
    : (shouldUseFunnelcake ? 'funnelcake' : 'websocket');

  return {
    data: activeQuery.data,
    fetchNextPage: activeQuery.fetchNextPage,
    hasNextPage: activeQuery.hasNextPage,
    isLoading: activeQuery.isLoading,
    error: activeQuery.error,
    refetch: activeQuery.refetch,
    dataSource: activeDataSource,
    apiUrl: shouldUseFunnelcake ? decision.apiUrl : undefined,
  };
}

/**
 * Hook to check if current relay supports Funnelcake
 */
export function useFunnelcakeSupport(): {
  supported: boolean;
  apiUrl: string;
  enabled: boolean;
} {
  const { config } = useAppContext();
  const relayUrl = config.relayUrl;

  const funnelcakeUrl = getFunnelcakeUrl(relayUrl) || DEFAULT_FUNNELCAKE_URL;
  const supported = true;
  const enabled = true;

  return {
    supported,
    apiUrl: funnelcakeUrl,
    enabled,
  };
}
