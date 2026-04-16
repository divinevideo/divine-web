import { useMemo } from 'react';
import { useInfiniteSearchVideos } from '@/hooks/useInfiniteSearchVideos';
import { useVideoProvider, type VideoFeedType } from '@/hooks/useVideoProvider';
import type { CompilationSource } from '@/lib/compilationPlayback';
import type { SortMode } from '@/types/nostr';

const DEFAULT_PAGE_SIZE = 12;

function flattenPages(
  data: { pages?: Array<{ videos: unknown[] }> } | undefined
) {
  return data?.pages.flatMap(page => page.videos) ?? [];
}

function getFeedType(source: Exclude<CompilationSource, { source: 'search' }>): VideoFeedType {
  switch (source.source) {
    case 'hashtag':
      return 'hashtag';
    case 'profile':
      return 'profile';
    case 'category':
      return 'category';
    default:
      return source.source;
  }
}

export function useCompilationSource(source: CompilationSource) {
  const searchQuery = useInfiniteSearchVideos({
    query: source.source === 'search' ? source.query : '',
    sortMode: (source.sort || 'relevance') as SortMode | 'relevance',
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const feedQuery = useVideoProvider({
    feedType: source.source === 'search' ? 'discovery' : getFeedType(source),
    sortMode: source.source === 'search' ? undefined : (source.sort as SortMode | undefined),
    hashtag: source.source === 'hashtag' ? source.tag : undefined,
    category: source.source === 'category' ? source.category : undefined,
    pubkey: source.source === 'profile' ? source.pubkey : undefined,
    pageSize: DEFAULT_PAGE_SIZE,
    enabled: source.source !== 'search',
  });

  return useMemo(() => {
    if (source.source === 'search') {
      return {
        kind: 'search' as const,
        videos: flattenPages(searchQuery.data),
        fetchNextPage: searchQuery.fetchNextPage,
        hasNextPage: searchQuery.hasNextPage,
        isLoading: searchQuery.isLoading,
        error: searchQuery.error,
      };
    }

    return {
      kind: 'feed' as const,
      videos: flattenPages(feedQuery.data),
      fetchNextPage: feedQuery.fetchNextPage,
      hasNextPage: feedQuery.hasNextPage,
      isLoading: feedQuery.isLoading,
      error: feedQuery.error,
    };
  }, [
    feedQuery.data,
    feedQuery.error,
    feedQuery.fetchNextPage,
    feedQuery.hasNextPage,
    feedQuery.isLoading,
    searchQuery.data,
    searchQuery.error,
    searchQuery.fetchNextPage,
    searchQuery.hasNextPage,
    searchQuery.isLoading,
    source,
  ]);
}
