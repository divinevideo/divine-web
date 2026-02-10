// ABOUTME: Hook to fetch profile data from Funnelcake /api/users/{pubkey} endpoint
// ABOUTME: Provides fast profile loading via REST API with retries

import { useQuery } from '@tanstack/react-query';
import { type FunnelcakeProfile } from '@/lib/funnelcakeClient';
import { DEFAULT_FUNNELCAKE_URL } from '@/config/relays';
import { API_CONFIG } from '@/config/api';
import { debugLog } from '@/lib/debug';

interface UseFunnelcakeProfileResult {
  data: FunnelcakeProfile | null | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Hook to fetch profile data from Funnelcake /api/users/{pubkey} endpoint
 *
 * Uses direct fetch with retries for reliability.
 */
export function useFunnelcakeProfile(
  pubkey: string | undefined,
  enabled: boolean = true
): UseFunnelcakeProfileResult {
  const query = useQuery({
    queryKey: ['funnelcake-profile', pubkey],

    queryFn: async ({ signal }) => {
      if (!pubkey) return null;

      const endpoint = API_CONFIG.funnelcake.endpoints.userProfile.replace('{pubkey}', pubkey);
      const url = `${DEFAULT_FUNNELCAKE_URL}${endpoint}`;

      debugLog(`[useFunnelcakeProfile] Fetching: ${url}`);

      const timeoutSignal = AbortSignal.timeout(8000); // 8 second timeout
      const combinedSignal = signal
        ? AbortSignal.any([signal, timeoutSignal])
        : timeoutSignal;

      const response = await fetch(url, {
        signal: combinedSignal,
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Profile fetch failed: ${response.status}`);
      }

      const data = await response.json();

      // Flatten the nested response
      const profile: FunnelcakeProfile = {
        pubkey: data.pubkey,
        name: data.profile?.name,
        display_name: data.profile?.display_name,
        picture: data.profile?.picture,
        banner: data.profile?.banner,
        about: data.profile?.about,
        nip05: data.profile?.nip05,
        lud16: data.profile?.lud16,
        website: data.profile?.website,
        video_count: data.stats?.video_count,
        follower_count: data.social?.follower_count,
        following_count: data.social?.following_count,
        total_reactions: data.engagement?.total_reactions,
        total_loops: data.engagement?.total_loops,
        total_views: data.engagement?.total_views,
      };

      debugLog(`[useFunnelcakeProfile] Got profile:`, profile.name || profile.display_name);
      return profile;
    },

    enabled: enabled && !!pubkey,
    staleTime: 60000,  // 1 minute
    gcTime: 300000,    // 5 minutes
    retry: 2,          // Retry twice on failure
    retryDelay: 500,   // 500ms between retries
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
