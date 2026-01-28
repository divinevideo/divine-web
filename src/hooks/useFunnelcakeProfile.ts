// ABOUTME: Hook to fetch profile data from Funnelcake /api/users/{pubkey} endpoint
// ABOUTME: Provides fast profile loading via REST API, falls back gracefully if unavailable

import { useQuery } from '@tanstack/react-query';
import { fetchUserProfile, type FunnelcakeProfile } from '@/lib/funnelcakeClient';
import { DEFAULT_FUNNELCAKE_URL } from '@/config/relays';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { debugLog } from '@/lib/debug';

interface UseFunnelcakeProfileResult {
  data: FunnelcakeProfile | null | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Hook to fetch profile data from Funnelcake /api/users/{pubkey} endpoint
 *
 * This provides fast profile loading by querying Funnelcake's REST API
 * which has cached profile metadata and pre-computed stats.
 *
 * Gracefully returns null if:
 * - Funnelcake is not available (circuit breaker open)
 * - The API request fails
 * - The profile is not found
 *
 * Returns:
 * - name, display_name, picture, banner, about
 * - nip05, lud16, website
 * - video_count, follower_count, following_count
 * - total_loops, total_reactions
 */
export function useFunnelcakeProfile(
  pubkey: string | undefined,
  enabled: boolean = true
): UseFunnelcakeProfileResult {
  // Check if Funnelcake is available (circuit breaker)
  const funnelcakeAvailable = isFunnelcakeAvailable(DEFAULT_FUNNELCAKE_URL);

  const query = useQuery({
    queryKey: ['funnelcake-profile', pubkey],

    queryFn: async ({ signal }) => {
      if (!pubkey) return null;

      // Double-check availability in case it changed
      if (!isFunnelcakeAvailable(DEFAULT_FUNNELCAKE_URL)) {
        debugLog(`[useFunnelcakeProfile] Funnelcake not available, skipping`);
        return null;
      }

      debugLog(`[useFunnelcakeProfile] Fetching profile for ${pubkey}`);
      const profile = await fetchUserProfile(DEFAULT_FUNNELCAKE_URL, pubkey, signal);

      if (profile) {
        debugLog(`[useFunnelcakeProfile] Got profile:`, profile);
      } else {
        debugLog(`[useFunnelcakeProfile] No profile found`);
      }

      return profile;
    },

    // Only enable if Funnelcake is available
    enabled: enabled && !!pubkey && funnelcakeAvailable,
    staleTime: 60000,  // 1 minute
    gcTime: 300000,    // 5 minutes
    retry: false,      // Don't retry - fall back to Nostr instead
  });

  return {
    data: query.data,
    isLoading: query.isLoading && funnelcakeAvailable,
    isError: query.isError,
  };
}
