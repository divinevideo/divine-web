// ABOUTME: Hook for searching hashtags using Funnelcake REST API
// ABOUTME: Provides trending hashtags with video counts and search filtering

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { getFunnelcakeBaseUrl } from '@/config/api';
import { fetchTrendingHashtags } from '@/lib/funnelcakeClient';

interface UseSearchHashtagsOptions {
  query: string;
  limit?: number;
}

export interface HashtagResult {
  hashtag: string;
  video_count: number;
}

/**
 * Proper debounce hook
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
 * Normalize user-entered hashtag search text for Funnelcake.
 */
function normalizeHashtagQuery(query: string): string {
  return query.trim().replace(/^#+/, '').trim().toLowerCase();
}

/**
 * Search hashtags using Funnelcake trending hashtags API
 */
export function useSearchHashtags(options: UseSearchHashtagsOptions) {
  const { query, limit = 20 } = options;

  const isTest = process.env.NODE_ENV === 'test';
  const debounceMs = isTest ? 0 : 300;
  const debouncedQuery = useDebouncedValue(query, debounceMs);

  return useQuery({
    queryKey: ['search-hashtags', debouncedQuery, limit],
    queryFn: async ({ signal }) => {
      const requestStartedAt = performance.now();
      const normalizedQuery = normalizeHashtagQuery(debouncedQuery);
      const requestContext = {
        query: normalizedQuery,
        limit,
        mode: normalizedQuery ? 'search' : 'popular',
      };

      console.info('[search/hashtags] starting', {
        ...requestContext,
        debounceMs,
      });

      const fetchStartedAt = performance.now();
      const hashtags = await fetchTrendingHashtags(
        getFunnelcakeBaseUrl(),
        normalizedQuery ? limit : 100,
        signal,
        normalizedQuery || undefined,
      );
      const fetchCompletedAt = performance.now();

      const finalHashtags: HashtagResult[] = hashtags.map(hashtag => ({
        hashtag: hashtag.hashtag,
        video_count: hashtag.video_count,
      }));

      console.info('[search/hashtags] completed', {
        ...requestContext,
        apiMs: Math.round(fetchCompletedAt - fetchStartedAt),
        totalMs: Math.round(fetchCompletedAt - requestStartedAt),
        fetchedHashtagCount: finalHashtags.length,
        matchedHashtagCount: finalHashtags.length,
        returnedHashtagCount: finalHashtags.length,
      });

      return finalHashtags;
    },
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
