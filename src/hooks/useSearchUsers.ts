// ABOUTME: Hook for searching user profiles via Funnelcake REST API
// ABOUTME: Fast, ranked results with follower/video counts and NIP-05 info

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useState, useEffect } from 'react';
import { searchProfiles, type FunnelcakeProfileResult } from '@/lib/funnelcakeClient';
import { DEFAULT_FUNNELCAKE_URL } from '@/config/relays';
import { debugLog } from '@/lib/debug';
import { reportFunnelcakeFallback } from '@/lib/funnelcakeFallbackReporting';
import type { NostrMetadata, NostrEvent } from '@nostrify/nostrify';

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
 * Parse kind:0 event into SearchUserResult
 */
function parseUserEvent(event: NostrEvent): SearchUserResult | null {
  try {
    const metadata = JSON.parse(event.content) as NostrMetadata;
    return { pubkey: event.pubkey, metadata };
  } catch {
    return null;
  }
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
 * Falls back to NIP-50 WebSocket if Funnelcake fails
 */
export function useSearchUsers(options: UseSearchUsersOptions) {
  const { nostr } = useNostr();
  const { query, limit = 20 } = options;

  const isTest = process.env.NODE_ENV === 'test';
  const debouncedQuery = useDebouncedValue(query, isTest ? 0 : 300);

  return useQuery({
    queryKey: ['search-users', debouncedQuery, limit],
    queryFn: async ({ signal }) => {
      if (!debouncedQuery.trim()) return [];

      // Try Funnelcake REST API first (fast, ranked)
      try {
        const profiles = await searchProfiles(
          DEFAULT_FUNNELCAKE_URL,
          debouncedQuery,
          Math.max(limit * 2, 50),
          signal,
        );

        // Re-rank: boost profiles with content above empty ones
        const searchLower = debouncedQuery.toLowerCase();
        profiles.sort((a, b) => {
          const aExact = a.name.toLowerCase() === searchLower ? 1 : 0;
          const bExact = b.name.toLowerCase() === searchLower ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;

          const aScore = a.video_count + a.follower_count;
          const bScore = b.video_count + b.follower_count;
          return bScore - aScore;
        });

        return profiles.slice(0, limit).map(toSearchUserResult);
      } catch (error) {
        debugLog('[useSearchUsers] Funnelcake profile search failed, falling back to NIP-50:', error);
        reportFunnelcakeFallback({
          source: 'useSearchUsers',
          apiUrl: DEFAULT_FUNNELCAKE_URL,
          reason: error instanceof Error ? error.message : String(error),
          dedupeKey: `useSearchUsers:${debouncedQuery}`,
          context: {
            query: debouncedQuery,
          },
        });
      }

      // Fallback: NIP-50 WebSocket search
      const events = await nostr.query(
        [{ kinds: [0], search: debouncedQuery, limit: Math.min(limit * 2, 100) }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) },
      );

      const seen = new Set<string>();
      const results: SearchUserResult[] = [];
      for (const event of events) {
        if (seen.has(event.pubkey)) continue;
        seen.add(event.pubkey);
        const parsed = parseUserEvent(event);
        if (parsed) results.push(parsed);
      }

      return results.slice(0, limit);
    },
    enabled: !!debouncedQuery.trim(),
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
