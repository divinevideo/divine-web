// ABOUTME: Hook for searching user profiles via Funnelcake REST API
// ABOUTME: Fast, ranked results with follower/video counts and NIP-05 info

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { searchProfiles, type FunnelcakeProfileResult } from '@/lib/funnelcakeClient';
import { DEFAULT_FUNNELCAKE_URL } from '@/config/relays';
import type { NostrMetadata } from '@nostrify/nostrify';

interface UseSearchUsersOptions {
  query: string;
  limit?: number;
}

export interface SearchUserResult {
  pubkey: string;
  metadata?: NostrMetadata;
}

/**
 * Convert Funnelcake profile result to SearchUserResult for compatibility
 */
function toSearchUserResult(profile: FunnelcakeProfileResult): SearchUserResult {
  return {
    pubkey: profile.pubkey,
    metadata: {
      name: profile.name,
      display_name: profile.display_name,
      nip05: profile.nip05 || undefined,
      about: profile.about || undefined,
      picture: profile.picture || undefined,
      banner: profile.banner || undefined,
    },
  };
}

/**
 * Proper debounce hook that returns a stable debounced value
 */
function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delay <= 0) {
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Search users via Funnelcake REST API (/api/search/profiles)
 * Returns ranked results instantly instead of slow WebSocket NIP-50
 */
export function useSearchUsers(options: UseSearchUsersOptions) {
  const { query, limit = 20 } = options;

  const isTest = process.env.NODE_ENV === 'test';
  const debouncedQuery = useDebouncedValue(query, isTest ? 0 : 300);

  return useQuery({
    queryKey: ['search-users', debouncedQuery, limit],
    queryFn: async ({ signal }) => {
      if (!debouncedQuery.trim()) return [];

      // Request extra results so we can re-rank and still fill the limit
      const profiles = await searchProfiles(
        DEFAULT_FUNNELCAKE_URL,
        debouncedQuery,
        Math.max(limit * 2, 50),
        signal,
      );

      // Re-rank: boost profiles with content above empty ones
      const searchLower = debouncedQuery.toLowerCase();
      profiles.sort((a, b) => {
        // Exact name match first
        const aExact = a.name.toLowerCase() === searchLower ? 1 : 0;
        const bExact = b.name.toLowerCase() === searchLower ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;

        // Then by engagement (videos + followers)
        const aScore = a.video_count + a.follower_count;
        const bScore = b.video_count + b.follower_count;
        return bScore - aScore;
      });

      return profiles.slice(0, limit).map(toSearchUserResult);
    },
    enabled: !!debouncedQuery.trim(),
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
