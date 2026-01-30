// ABOUTME: Unified video provider hook that selects between Funnelcake and WebSocket
// ABOUTME: Automatically falls back to WebSocket when Funnelcake is unavailable

import { useAppContext } from '@/hooks/useAppContext';
import { useInfiniteVideos } from '@/hooks/useInfiniteVideos';
import { useInfiniteVideosFunnelcake, type FunnelcakeFeedType, type FunnelcakeSortMode } from '@/hooks/useInfiniteVideosFunnelcake';
import { hasFunnelcake, getFunnelcakeUrl, DEFAULT_FUNNELCAKE_URL } from '@/config/relays';
import { getFeatureFlag } from '@/config/api';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { debugLog } from '@/lib/debug';
import type { SortMode } from '@/types/nostr';

// Feed types that can be provided
export type VideoFeedType = 'discovery' | 'home' | 'trending' | 'hashtag' | 'profile' | 'recent' | 'classics' | 'foryou';

interface UseVideoProviderOptions {
  feedType: VideoFeedType;
  sortMode?: SortMode;
  hashtag?: string;
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
    default:
      return 'trending';
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
    default:
      return 'trending';
  }
}

/**
 * Unified video provider hook
 *
 * Automatically selects the best data source:
 * 1. Classics feed ALWAYS uses Divine's Funnelcake (regardless of selected relay)
 * 2. Divine relays use Funnelcake REST API (with circuit breaker fallback)
 * 3. Non-Divine relays use WebSocket queries
 *
 * The hook exposes `dataSource` to indicate which backend is being used.
 */
export function useVideoProvider({
  feedType,
  sortMode,
  hashtag,
  pubkey,
  pageSize = 20,
  enabled = true,
}: UseVideoProviderOptions): VideoProviderResult {
  const { config } = useAppContext();
  const relayUrl = config.relayUrl;

  // Determine if we should use Funnelcake
  const useFunnelcakeFlag = getFeatureFlag('useFunnelcake');
  const funnelcakeUrl = getFunnelcakeUrl(relayUrl);
  const relayHasFunnelcake = hasFunnelcake(relayUrl);

  // Decision logic:
  // 1. Classics ALWAYS use Divine's Funnelcake
  // 2. Feature flag must be enabled
  // 3. Current relay must support Funnelcake
  // 4. Circuit breaker must allow requests
  const isClassics = feedType === 'classics';
  const shouldUseFunnelcake = isClassics || !!(
    useFunnelcakeFlag &&
    relayHasFunnelcake &&
    funnelcakeUrl &&
    isFunnelcakeAvailable(funnelcakeUrl)
  );

  debugLog(`[useVideoProvider] Feed: ${feedType}, Relay: ${relayUrl}, Funnelcake: ${shouldUseFunnelcake ? 'yes' : 'no'}`);

  // Funnelcake query (enabled only when shouldUseFunnelcake is true)
  const funnelcakeQuery = useInfiniteVideosFunnelcake({
    feedType: mapToFunnelcakeFeedType(feedType),
    apiUrl: isClassics ? DEFAULT_FUNNELCAKE_URL : funnelcakeUrl || undefined,
    sortMode: mapToFunnelcakeSortMode(sortMode),
    hashtag,
    pubkey,
    pageSize,
    enabled: enabled && shouldUseFunnelcake,
  });

  // WebSocket query (enabled only when shouldUseFunnelcake is false)
  // Map 'classics' to 'trending' with 'top' sort for WebSocket fallback
  const websocketFeedType = feedType === 'classics' ? 'trending' : feedType;
  const websocketSortMode = feedType === 'classics' ? 'top' : sortMode;

  const websocketQuery = useInfiniteVideos({
    feedType: websocketFeedType as 'discovery' | 'home' | 'trending' | 'hashtag' | 'profile' | 'recent',
    sortMode: websocketSortMode,
    hashtag,
    pubkey,
    pageSize,
    enabled: enabled && !shouldUseFunnelcake,
  });

  // Select the active query based on data source
  const activeQuery = shouldUseFunnelcake ? funnelcakeQuery : websocketQuery;

  return {
    data: activeQuery.data,
    fetchNextPage: activeQuery.fetchNextPage,
    hasNextPage: activeQuery.hasNextPage,
    isLoading: activeQuery.isLoading,
    error: activeQuery.error,
    refetch: activeQuery.refetch,
    dataSource: shouldUseFunnelcake ? 'funnelcake' : 'websocket',
    apiUrl: shouldUseFunnelcake ? (isClassics ? DEFAULT_FUNNELCAKE_URL : funnelcakeUrl || undefined) : undefined,
  };
}

/**
 * Hook to check if current relay supports Funnelcake
 */
export function useFunnelcakeSupport(): {
  supported: boolean;
  apiUrl: string | null;
  enabled: boolean;
} {
  const { config } = useAppContext();
  const relayUrl = config.relayUrl;

  const funnelcakeUrl = getFunnelcakeUrl(relayUrl);
  const supported = hasFunnelcake(relayUrl);
  const enabled = getFeatureFlag('useFunnelcake');

  return {
    supported,
    apiUrl: funnelcakeUrl,
    enabled,
  };
}
