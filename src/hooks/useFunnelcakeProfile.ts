// ABOUTME: Hook to fetch profile data from Funnelcake /api/users/{pubkey} endpoint
// ABOUTME: Provides fast profile loading via REST API, falls back gracefully if unavailable

import { useQuery } from '@tanstack/react-query';
import { fetchUserProfile, type FunnelcakeProfile } from '@/lib/funnelcakeClient';
import { DEFAULT_FUNNELCAKE_URL } from '@/config/relays';

interface UseFunnelcakeProfileResult {
  data: FunnelcakeProfile | null | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Hook to fetch profile data from Funnelcake /api/users/{pubkey} endpoint
 *
 * This provides FAST profile loading - no circuit breaker, just fetch immediately.
 */
export function useFunnelcakeProfile(
  pubkey: string | undefined,
  enabled: boolean = true
): UseFunnelcakeProfileResult {
  const query = useQuery({
    queryKey: ['funnelcake-profile', pubkey],

    queryFn: async ({ signal }) => {
      if (!pubkey) return null;
      return fetchUserProfile(DEFAULT_FUNNELCAKE_URL, pubkey, signal);
    },

    enabled: enabled && !!pubkey,
    staleTime: 60000,  // 1 minute
    gcTime: 300000,    // 5 minutes
    retry: false,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
