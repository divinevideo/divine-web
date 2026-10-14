// ABOUTME: Hook for fetching paginated followers list from Funnelcake REST API
// ABOUTME: Uses useInfiniteQuery for infinite scroll pagination

import { useInfiniteQuery } from '@tanstack/react-query';
import { API_CONFIG } from '@/config/api';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { debugLog } from '@/lib/debug';

const PAGE_SIZE = 50;

interface FollowersResponse {
  pubkeys: string[];
  total?: number;
  limit?: number;
  has_more: boolean;
  query?: string;
}

/**
 * Fetch followers for a user with pagination
 */
async function fetchUserFollowers(
  apiUrl: string,
  pubkey: string,
  options: { limit?: number; offset?: number; query?: string },
  signal?: AbortSignal
): Promise<FollowersResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  if (options.query) params.set('q', options.query);

  const url = `${apiUrl}/api/users/${pubkey}/followers?${params}`;
  debugLog(`[useFollowers] Fetching: ${url}`);

  const response = await fetch(url, {
    signal,
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  // Handle different response formats
  const pubkeys = Array.isArray(data) ? data : (data.pubkeys || data.followers || []);

  if (options.query && data.query !== options.query) {
    throw new Error('Follow-list search unavailable');
  }

  return {
    pubkeys,
    total: data.total,
    limit: typeof data.limit === 'number' ? data.limit : undefined,
    has_more: typeof data.total === 'number'
      ? pubkeys.length >= (typeof data.limit === 'number' ? data.limit : (options.limit || PAGE_SIZE))
        && (options.offset ?? 0) + pubkeys.length < data.total
      : pubkeys.length >= (options.limit || PAGE_SIZE),
    query: data.query,
  };
}

/**
 * Hook for fetching paginated followers with infinite scroll
 */
export function useFollowers(pubkey: string, query = '') {
  const apiUrl = API_CONFIG.funnelcake.baseUrl;

  return useInfiniteQuery({
    queryKey: ['followers', pubkey, query],
    queryFn: async ({ pageParam = 0, signal }) => {
      if (!isFunnelcakeAvailable(apiUrl)) {
        throw new Error('Funnelcake unavailable');
      }

      return fetchUserFollowers(apiUrl, pubkey, {
        limit: PAGE_SIZE,
        offset: pageParam,
        query: query || undefined,
      }, signal);
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined;
      const totalFetched = allPages.reduce((sum, p) => sum + p.pubkeys.length, 0);
      return totalFetched;
    },
    initialPageParam: 0,
    enabled: !!pubkey && isFunnelcakeAvailable(apiUrl),
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
}

/**
 * Get all follower pubkeys from paginated results
 */
export function getAllFollowerPubkeys(data: ReturnType<typeof useFollowers>['data']): string[] {
  if (!data?.pages) return [];
  return data.pages.flatMap(page => page.pubkeys);
}
