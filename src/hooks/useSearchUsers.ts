// ABOUTME: Hook for searching user profiles via Funnelcake REST API
// ABOUTME: Fast, ranked results with follower/video counts and NIP-05 info

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useState, useEffect } from 'react';
import { searchProfiles, type FunnelcakeProfileResult } from '@/lib/funnelcakeClient';
import { API_CONFIG } from '@/config/api';
import { debugLog } from '@/lib/debug';
import { reportFunnelcakeFallback } from '@/lib/funnelcakeFallbackReporting';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import type { NostrMetadata, NostrEvent } from '@nostrify/nostrify';

interface UseSearchUsersOptions {
  query: string;
  limit?: number;
}

export interface SearchUserResult {
  pubkey: string;
  metadata?: NostrMetadata;
}

const FUNNELCAKE_PROFILE_SEARCH_TIMEOUT_MS = 5000;

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
  const apiUrl = API_CONFIG.funnelcake.baseUrl;

  const isTest = process.env.NODE_ENV === 'test';
  const debounceMs = isTest ? 0 : 300;
  const debouncedQuery = useDebouncedValue(query, debounceMs);

  return useQuery({
    queryKey: ['search-users', debouncedQuery, limit],
    queryFn: async ({ signal }) => {
      if (!debouncedQuery.trim()) {
        return [];
      }

      const requestStartedAt = performance.now();
      const requestContext = {
        query: debouncedQuery,
        limit,
      };

      console.info('[search/users] starting', {
        ...requestContext,
        debounceMs,
      });

      if (isFunnelcakeAvailable(apiUrl)) {
        try {
          const apiStartedAt = performance.now();
          const profiles = await searchProfiles(
            apiUrl,
            {
              query: debouncedQuery,
              limit,
              sortBy: 'relevance',
              signal: AbortSignal.any([signal, AbortSignal.timeout(FUNNELCAKE_PROFILE_SEARCH_TIMEOUT_MS)]),
            },
          );
          const finalUsers = profiles.map(toSearchUserResult);
          const apiCompletedAt = performance.now();

          console.info('[search/users] funnelcake query complete', {
            ...requestContext,
            apiMs: Math.round(apiCompletedAt - apiStartedAt),
            totalMs: Math.round(apiCompletedAt - requestStartedAt),
            profileCount: profiles.length,
            returnedUserCount: finalUsers.length,
          });

          return finalUsers;
        } catch (error) {
          console.warn('[search/users] falling back to relay search', {
            ...requestContext,
            error,
            totalMs: Math.round(performance.now() - requestStartedAt),
          });
          debugLog('[useSearchUsers] Funnelcake profile search failed, falling back to NIP-50:', error);
          reportFunnelcakeFallback({
            source: 'useSearchUsers',
            apiUrl,
            reason: error instanceof Error ? error.message : String(error),
            dedupeKey: `useSearchUsers:${debouncedQuery}`,
            context: {
              query: debouncedQuery,
            },
          });
        }
      } else {
        console.warn('[search/users] funnelcake unavailable, falling back to relay search', {
          ...requestContext,
          totalMs: Math.round(performance.now() - requestStartedAt),
        });
        reportFunnelcakeFallback({
          source: 'useSearchUsers',
          apiUrl,
          reason: 'Funnelcake unavailable or circuit breaker open',
          dedupeKey: `useSearchUsers:${debouncedQuery}:unavailable`,
          context: {
            query: debouncedQuery,
          },
        });
      }

      const relayStartedAt = performance.now();
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
        if (parsed) {
          results.push(parsed);
        }
      }

      const finalUsers = results.slice(0, limit);
      const relayCompletedAt = performance.now();

      console.info('[search/users] completed', {
        ...requestContext,
        mode: 'nip50',
        relayMs: Math.round(relayCompletedAt - relayStartedAt),
        totalMs: Math.round(relayCompletedAt - requestStartedAt),
        rawEventCount: events.length,
        returnedUserCount: finalUsers.length,
      });

      return finalUsers;
    },
    enabled: !!debouncedQuery.trim(),
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
