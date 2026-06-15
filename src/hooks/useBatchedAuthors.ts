// ABOUTME: Hook for efficiently fetching multiple author profiles via Funnelcake REST API
// ABOUTME: Falls back to WebSocket query when Funnelcake is unavailable

import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { API_CONFIG } from '@/config/api';
import { fetchBulkUsers } from '@/lib/funnelcakeClient';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { debugLog } from '@/lib/debug';
import { reportFunnelcakeFallback } from '@/lib/funnelcakeFallbackReporting';

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

  // Get unique pubkeys
  const uniquePubkeys = Array.from(new Set(pubkeys.filter(Boolean)));

  const query = useQuery({
    queryKey: ['batched-authors', uniquePubkeys.sort().join(',')],
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
    },
    staleTime: 300000, // Cache for 5 minutes
    gcTime: 1800000, // Keep in cache for 30 minutes
    enabled: uniquePubkeys.length > 0,
  });

  // Populate individual author cache entries so useAuthor hooks can use them
  useEffect(() => {
    if (query.data) {
      Object.entries(query.data).forEach(([pubkey, authorData]) => {
        queryClient.setQueryData(['author', pubkey], authorData);
      });
    }
  }, [query.data, queryClient]);

  return query;
}
