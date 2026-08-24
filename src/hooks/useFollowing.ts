// ABOUTME: Hook for fetching following list from Funnelcake REST API
// ABOUTME: Pages complete following lists and server-filtered searches

import { useInfiniteQuery } from '@tanstack/react-query';
import { API_CONFIG } from '@/config/api';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { debugLog } from '@/lib/debug';

interface FollowingResponse {
  pubkeys: string[];
  total?: number;
  limit?: number;
  has_more: boolean;
  query?: string;
}

/**
 * Fetch following list for a user
 */
/**
 * The endpoint clamps `limit` to 100 per page. Without paging, a list longer
 * than that is silently truncated — the dialog just loses people, with nothing
 * on screen to say so.
 */
const FOLLOWING_PAGE_SIZE = 100;

async function fetchFollowingPage(
  apiUrl: string,
  pubkey: string,
  offset: number,
  query: string,
  signal?: AbortSignal
): Promise<FollowingResponse> {
  const params = new URLSearchParams({
    limit: String(FOLLOWING_PAGE_SIZE),
    offset: String(offset),
  });
  if (query) params.set('q', query);
  const url = `${apiUrl}/api/users/${pubkey}/following?${params}`;
  debugLog(`[useFollowing] Fetching: ${url}`);

  const response = await fetch(url, {
    signal,
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  // Handle different response formats
  const pubkeys = Array.isArray(data) ? data : (data.pubkeys || data.following || []);
  if (query && data.query !== query) {
    throw new Error('Follow-list search unavailable');
  }

  const total = typeof data.total === 'number' ? data.total : pubkeys.length;

  return {
    pubkeys,
    total,
    limit: typeof data.limit === 'number' ? data.limit : undefined,
    has_more: pubkeys.length >= (typeof data.limit === 'number' ? data.limit : FOLLOWING_PAGE_SIZE)
      && offset + pubkeys.length < total,
    query: data.query,
  };
}

/**
 * Hook for fetching following list
 */
export function useFollowing(pubkey: string, query = '') {
  const apiUrl = API_CONFIG.funnelcake.baseUrl;

  return useInfiniteQuery({
    queryKey: ['following', pubkey, query],
    queryFn: async ({ pageParam = 0, signal }) => {
      if (!isFunnelcakeAvailable(apiUrl)) {
        throw new Error('Funnelcake unavailable');
      }

      return fetchFollowingPage(apiUrl, pubkey, pageParam, query, signal);
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined;
      return allPages.reduce((sum, page) => sum + page.pubkeys.length, 0);
    },
    initialPageParam: 0,
    enabled: !!pubkey && isFunnelcakeAvailable(apiUrl),
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
}

export function getAllFollowingPubkeys(data: ReturnType<typeof useFollowing>['data']): string[] {
  if (!data?.pages) return [];
  return data.pages.flatMap((page) => page.pubkeys);
}
