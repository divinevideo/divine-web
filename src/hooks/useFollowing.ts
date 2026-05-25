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
async function fetchUserFollowing(
  apiUrl: string,
  pubkey: string,
  signal?: AbortSignal
): Promise<FollowingResponse> {
  const url = `${apiUrl}/api/users/${pubkey}/following`;
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
