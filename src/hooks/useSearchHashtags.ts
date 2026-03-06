// ABOUTME: Hook for searching hashtags using Funnelcake REST API
// ABOUTME: Provides trending hashtags with video counts and search filtering

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
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

  const isTest = process.env.NODE_ENV === 'test';
  const debounceMs = isTest ? 0 : 300;
  const debouncedQuery = useDebouncedValue(query, debounceMs);

  return useQuery({
    queryKey: ['search-hashtags', debouncedQuery, limit],
    queryFn: async ({ signal }) => {
      const requestStartedAt = performance.now();
      const requestContext = {
        query: debouncedQuery,
        limit,
        mode: debouncedQuery.trim() ? 'search' : 'popular',
      };

      console.info('[search/hashtags] starting', {
        ...requestContext,
        debounceMs,
      });

      const fetchStartedAt = performance.now();
      const hashtags = await fetchTrendingHashtags(
        DEFAULT_FUNNELCAKE_URL,
        100,
        signal,
      );
      const fetchCompletedAt = performance.now();

      const allHashtags: HashtagResult[] = hashtags.map(hashtag => ({
        hashtag: hashtag.hashtag,
        video_count: hashtag.video_count,
      }));

      const filteredHashtags = filterHashtagsByQuery(allHashtags, debouncedQuery);
      const finalHashtags = filteredHashtags.slice(0, limit);

      console.info('[search/hashtags] completed', {
        ...requestContext,
        apiMs: Math.round(fetchCompletedAt - fetchStartedAt),
        totalMs: Math.round(fetchCompletedAt - requestStartedAt),
        fetchedHashtagCount: allHashtags.length,
        matchedHashtagCount: filteredHashtags.length,
        returnedHashtagCount: finalHashtags.length,
      });

      return finalHashtags;
    },
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
