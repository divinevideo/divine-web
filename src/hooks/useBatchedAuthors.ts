// ABOUTME: Hook for efficiently fetching multiple author profiles via Funnelcake REST API
// ABOUTME: Falls back to WebSocket query when Funnelcake is unavailable

import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { API_CONFIG } from '@/config/api';
import { fetchBulkUsers } from '@/lib/funnelcakeClient';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { debugLog } from '@/lib/debug';
import { isAbortError, reportFunnelcakeFallback } from '@/lib/funnelcakeFallbackReporting';
import {
  cancelPendingAuthorBatch,
  prepareInFlightAuthorBatch,
  registerInFlightAuthorBatch,
} from '@/lib/batchedAuthorRegistry';

interface AuthorData {
  event?: NostrEvent;
  metadata?: NostrMetadata;
}

/**
 * Fetch multiple author profiles in a single query and populate the cache
 * Uses Funnelcake REST API when available, falls back to WebSocket
 */
export function useBatchedAuthors(pubkeys: string[]) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const apiUrl = API_CONFIG.funnelcake.baseUrl;

  // Get sorted unique pubkeys with stable identity
  const pubkeysKey = Array.from(new Set(pubkeys.filter(Boolean))).sort().join(',');
  const uniquePubkeys = useMemo(
    () => (pubkeysKey ? pubkeysKey.split(',') : []),
    [pubkeysKey],
  );

  // Reserve in-flight slots synchronously during parent render (before child
  // VideoCards subscribe and trigger useAuthor) for any pubkeys not yet cached.
  // Release unattached slots if the parent unmounts before queryFn starts.
  const uncachedPubkeys = useMemo(() => {
    const missing = uniquePubkeys.filter(
      (pk) => queryClient.getQueryData(['author', pk]) === undefined,
    );
    if (missing.length > 0) {
      prepareInFlightAuthorBatch(missing);
    }
    return missing;
  }, [uniquePubkeys, queryClient]);

  useEffect(() => {
    return () => {
      if (uncachedPubkeys.length > 0) {
        cancelPendingAuthorBatch(uncachedPubkeys);
      }
    };
  }, [uncachedPubkeys]);

  const query = useQuery({
    queryKey: ['batched-authors', pubkeysKey],
    queryFn: async ({ signal }) => {
      if (uniquePubkeys.length === 0) {
        return {};
      }

      const reportFallback = (reason: string) => {
        reportFunnelcakeFallback({
          source: 'useBatchedAuthors',
          apiUrl,
          reason,
          dedupeKey: `useBatchedAuthors:${uniquePubkeys.join(',')}:${reason}`,
          context: {
            pubkeyCount: uniquePubkeys.length,
          },
        });
      };

      const batchPromise = (async (): Promise<Record<string, AuthorData>> => {
        // Try Funnelcake REST API first (faster than WebSocket)
        if (isFunnelcakeAvailable(apiUrl)) {
          try {
            debugLog(`[useBatchedAuthors] Using Funnelcake REST API for ${uniquePubkeys.length} authors`);
            const response = await fetchBulkUsers(apiUrl, uniquePubkeys, signal);

            const authorsMap: Record<string, AuthorData> = {};

            for (const user of response.users) {
              // Transform Funnelcake profile to NostrMetadata format
              const metadata: NostrMetadata = {
                name: user.profile?.name,
                display_name: user.profile?.display_name,
                picture: user.profile?.picture,
                banner: user.profile?.banner,
                about: user.profile?.about,
                nip05: user.profile?.nip05,
                lud16: user.profile?.lud16,
                website: user.profile?.website,
              };

              authorsMap[user.pubkey] = { metadata };
            }

            debugLog(`[useBatchedAuthors] REST API returned ${response.users.length} users, ${response.missing.length} missing`);
            return authorsMap;
          } catch (err) {
            // Cancelled queries are not failures — surface the abort to
            // React Query without reporting or falling back (#459)
            if (isAbortError(err)) {
              throw err;
            }
            debugLog(`[useBatchedAuthors] REST API failed, falling back to WebSocket:`, err);
            reportFallback(err instanceof Error ? err.message : String(err));
            // Fall through to WebSocket fallback
          }
        } else {
          reportFallback('Funnelcake unavailable or circuit breaker open');
        }

        // WebSocket fallback
        debugLog(`[useBatchedAuthors] Using WebSocket for ${uniquePubkeys.length} authors`);

        const events = await nostr.query(
          [{ kinds: [0], authors: uniquePubkeys, limit: uniquePubkeys.length }],
          { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) },
        );

        // Parse metadata and create a map
        const authorsMap: Record<string, AuthorData> = {};

        for (const event of events) {
          try {
            const metadata = n.json().pipe(n.metadata()).parse(event.content);
            authorsMap[event.pubkey] = { event, metadata };
          } catch {
            authorsMap[event.pubkey] = { event };
          }
        }

        return authorsMap;
      })();

      registerInFlightAuthorBatch(uniquePubkeys, batchPromise);
      const authorsMap = await batchPromise;

      // Populate individual author caches immediately so cards don't wait an extra effect tick
      for (const [pubkey, authorData] of Object.entries(authorsMap)) {
        queryClient.setQueryData(['author', pubkey], authorData);
      }

      return authorsMap;
    },
    staleTime: 300000, // Cache for 5 minutes
    gcTime: 1800000, // Keep in cache for 30 minutes
    enabled: uniquePubkeys.length > 0,
  });

  return query;
}
