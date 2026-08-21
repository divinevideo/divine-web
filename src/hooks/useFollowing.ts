// ABOUTME: Hook for fetching following list from Funnelcake REST API
// ABOUTME: Returns full list of pubkeys the user follows

import { useQuery } from '@tanstack/react-query';
import { API_CONFIG } from '@/config/api';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { debugLog } from '@/lib/debug';

interface FollowingResponse {
  pubkeys: string[];
  total?: number;
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

/** Backstop so a pathological `total` cannot page forever. */
const FOLLOWING_MAX_PAGES = 30;

async function fetchFollowingPage(
  apiUrl: string,
  pubkey: string,
  offset: number,
  signal?: AbortSignal
): Promise<FollowingResponse> {
  const url = `${apiUrl}/api/users/${pubkey}/following?limit=${FOLLOWING_PAGE_SIZE}&offset=${offset}`;
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

  return {
    pubkeys,
    total: data.total || pubkeys.length,
  };
}

async function fetchUserFollowing(
  apiUrl: string,
  pubkey: string,
  signal?: AbortSignal
): Promise<FollowingResponse> {
  const pubkeys: string[] = [];
  let total = 0;

  for (let page = 0; page < FOLLOWING_MAX_PAGES; page += 1) {
    const result = await fetchFollowingPage(apiUrl, pubkey, pubkeys.length, signal);
    pubkeys.push(...result.pubkeys);
    total = result.total ?? pubkeys.length;

    // A short page means the server has nothing more, whatever `total` claims.
    if (result.pubkeys.length < FOLLOWING_PAGE_SIZE || pubkeys.length >= total) {
      break;
    }
  }

  return {
    pubkeys,
    total: Math.max(total, pubkeys.length),
  };
}

/**
 * Hook for fetching following list
 */
export function useFollowing(pubkey: string) {
  const apiUrl = API_CONFIG.funnelcake.baseUrl;

  return useQuery({
    queryKey: ['following', pubkey],
    queryFn: async ({ signal }) => {
      if (!isFunnelcakeAvailable(apiUrl)) {
        throw new Error('Funnelcake unavailable');
      }

      return fetchUserFollowing(apiUrl, pubkey, signal);
    },
    enabled: !!pubkey && isFunnelcakeAvailable(apiUrl),
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
}
