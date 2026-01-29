// ABOUTME: Hook for searching hashtags using Funnelcake REST API
// ABOUTME: Provides trending hashtags with video counts and search filtering

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchTrendingHashtags } from '@/lib/funnelcakeClient';
import { DEFAULT_FUNNELCAKE_URL } from '@/config/relays';

interface UseSearchHashtagsOptions {
  query: string;
  limit?: number;
}

export interface HashtagResult {
  hashtag: string;
  video_count: number;
}

/**
 * Filter hashtags by search query
 */
function filterHashtagsByQuery(hashtags: HashtagResult[], query: string): HashtagResult[] {
  if (!query.trim()) {
    return hashtags;
  }

  const searchValue = query.toLowerCase();

  return hashtags.filter(hashtag =>
    hashtag.hashtag.toLowerCase().includes(searchValue)
  );
}

/**
 * Search hashtags using Funnelcake trending hashtags API
 */
export function useSearchHashtags(options: UseSearchHashtagsOptions) {
  const { query, limit = 20 } = options;

  // Debounce the query - disable in test environment
  const isTest = process.env.NODE_ENV === 'test';
  const debounceDelay = isTest ? 0 : 300;

  const debouncedQuery = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return new Promise<string>((resolve) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => resolve(query), debounceDelay);
    });
  }, [query, debounceDelay]);

  return useQuery({
    queryKey: ['search-hashtags', query, limit],
    queryFn: async (context) => {
      // Wait for debounced query
      const actualQuery = await debouncedQuery;

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(10000)
      ]);

      // Fetch trending hashtags from Funnelcake
      const hashtags = await fetchTrendingHashtags(
        DEFAULT_FUNNELCAKE_URL,
        100, // Fetch more to allow for filtering
        signal
      );

      // Transform to HashtagResult format
      const allHashtags: HashtagResult[] = hashtags.map(h => ({
        hashtag: h.hashtag,
        video_count: h.video_count,
      }));

      // Filter by search query
      const filteredHashtags = filterHashtagsByQuery(allHashtags, actualQuery);

      // Apply limit
      return filteredHashtags.slice(0, limit);
    },
    staleTime: 60000, // 1 minute (Funnelcake data is pre-computed)
    gcTime: 300000, // 5 minutes
  });
}
