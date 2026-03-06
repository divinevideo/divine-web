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
  const debouncedQuery = useDebouncedValue(query, isTest ? 0 : 300);

  return useQuery({
    queryKey: ['search-hashtags', debouncedQuery, limit],
    queryFn: async ({ signal }) => {
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
      const filteredHashtags = filterHashtagsByQuery(allHashtags, debouncedQuery);

      // Apply limit
      return filteredHashtags.slice(0, limit);
    },
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
