// ABOUTME: Component for exploring and discovering hashtags using Funnelcake REST API
// ABOUTME: Shows popular hashtags with thumbnails and search filtering

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { SmartLink } from '@/components/SmartLink';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Hash, Search, Play, Loader2 } from 'lucide-react';
import { fetchPopularHashtags, searchVideos } from '@/lib/funnelcakeClient';
import { DEFAULT_FUNNELCAKE_URL } from '@/config/relays';

interface HashtagStats {
  tag: string;
  count: number;
  rank: number;
}

interface _HashtagWithThumbnail extends HashtagStats {
  thumbnailUrl?: string;
}

/**
 * Hook to fetch hashtag statistics from Funnelcake API
 */
function useHashtagStats() {
  return useQuery({
    queryKey: ['popular-hashtags'],
    queryFn: async (context) => {
      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(10000),
      ]);

      const hashtags = await fetchPopularHashtags(DEFAULT_FUNNELCAKE_URL, 100, signal);

      // Transform to HashtagStats format with rank
      const stats: HashtagStats[] = hashtags.map((h, index) => ({
        tag: h.hashtag,
        count: h.video_count,
        rank: index + 1,
      }));

      return stats;
    },
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
}

/**
 * Component for individual hashtag card with thumbnail
 */
function HashtagCard({ stat, thumbnailUrl }: { stat: HashtagStats; thumbnailUrl?: string }) {
  return (
    <SmartLink to={`/hashtag/${stat.tag}`} className="block group">
      <Card className="hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer hover:scale-[1.02]">
        {/* Thumbnail */}
        <div className="relative aspect-square bg-muted overflow-hidden">
          {thumbnailUrl ? (
            <>
              {thumbnailUrl.endsWith('.mp4') || thumbnailUrl.endsWith('.webm') || thumbnailUrl.endsWith('.mov') ? (
                <video
                  src={thumbnailUrl}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img
                  src={thumbnailUrl}
                  alt={`#${stat.tag}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
              <Hash className="h-12 w-12 text-primary/30" />
            </div>
          )}

          {/* Overlay info */}
          <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-1">
                  <Hash className="h-4 w-4" />
                  {stat.tag}
                </h3>
              </div>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                #{stat.rank}
              </Badge>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <CardContent className="p-3">
          <Button variant="outline" size="sm" className="w-full pointer-events-none">
            <Play className="h-3 w-3 mr-1" />
            Watch #{stat.tag}
          </Button>
        </CardContent>
      </Card>
    </SmartLink>
  );
}

/**
 * Hook to fetch thumbnails for hashtags with deduplication
 * Uses a two-pass approach: first fetch 1 video each, then fetch more only for duplicates
 */
function useHashtagThumbnails(hashtags: string[]) {
  // First pass: fetch top 1 video per hashtag
  const initialQueries = useQueries({
    queries: hashtags.map(tag => ({
      queryKey: ['hashtag-thumbnail-initial', tag],
      queryFn: async () => {
        const signal = AbortSignal.timeout(8000);
        const response = await searchVideos(DEFAULT_FUNNELCAKE_URL, {
          tag,
          limit: 1,
          sort: 'trending',
          signal,
        });
        const video = response.videos[0];
        return {
          tag,
          url: video?.thumbnail || video?.video_url || null,
        };
      },
      staleTime: 300000,
      gcTime: 900000,
    })),
  });

  // Identify duplicates that need more videos
  const { duplicateTags, urlToFirstTag: _urlToFirstTag } = useMemo(() => {
    const urlToFirstTag = new Map<string, string>();
    const duplicateTags: string[] = [];

    for (const query of initialQueries) {
      if (query.data?.url) {
        const { tag, url } = query.data;
        if (urlToFirstTag.has(url)) {
          // This is a duplicate - the tag needs more videos
          duplicateTags.push(tag);
        } else {
          urlToFirstTag.set(url, tag);
        }
      }
    }

    return { duplicateTags, urlToFirstTag };
  }, [initialQueries]);

  // Second pass: fetch more videos only for duplicate hashtags
  const extraQueries = useQueries({
    queries: duplicateTags.map(tag => ({
      queryKey: ['hashtag-thumbnail-extra', tag],
      queryFn: async () => {
        const signal = AbortSignal.timeout(8000);
        const response = await searchVideos(DEFAULT_FUNNELCAKE_URL, {
          tag,
          limit: 10,  // Get more videos to find a unique one
          sort: 'trending',
          signal,
        });
        return {
          tag,
          videos: response.videos.map(v => v.thumbnail || v.video_url).filter(Boolean),
        };
      },
      staleTime: 300000,
      gcTime: 900000,
      enabled: duplicateTags.length > 0,
    })),
  });

  // Build final thumbnail map with deduplication
  const thumbnailMap = useMemo(() => {
    const map = new Map<string, string>();
    const usedUrls = new Set<string>();

    // First, add all non-duplicate thumbnails
    for (const query of initialQueries) {
      if (query.data?.url) {
        const { tag, url } = query.data;
        if (!duplicateTags.includes(tag)) {
          map.set(tag, url);
          usedUrls.add(url);
        }
      }
    }

    // Then process duplicates with their extra videos
    for (const extraQuery of extraQueries) {
      if (extraQuery.data) {
        const { tag, videos } = extraQuery.data;
        for (const url of videos) {
          if (!usedUrls.has(url)) {
            map.set(tag, url);
            usedUrls.add(url);
            break;
          }
        }
      }
    }

    return map;
  }, [initialQueries, extraQueries, duplicateTags]);

  return {
    thumbnailMap,
    isLoading: initialQueries.some(q => q.isLoading),
  };
}

const INITIAL_LOAD = 20;
const LOAD_MORE_COUNT = 20;

export function HashtagExplorer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { data: hashtagStats, isLoading, error } = useHashtagStats();

  // Filter hashtags based on search
  const filteredTags = useMemo(() => {
    if (!hashtagStats) return [];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return hashtagStats.filter(stat => stat.tag.includes(search));
    }

    return hashtagStats;
  }, [hashtagStats, searchTerm]);

  // Get visible subset
  const visibleTags = useMemo(() => {
    return filteredTags.slice(0, visibleCount);
  }, [filteredTags, visibleCount]);

  // Fetch thumbnails for visible hashtags with deduplication
  const visibleHashtags = useMemo(() => visibleTags.map(t => t.tag), [visibleTags]);
  const { thumbnailMap } = useHashtagThumbnails(visibleHashtags);

  const hasMore = visibleCount < filteredTags.length;

  // Load more when sentinel comes into view
  const loadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount(prev => Math.min(prev + LOAD_MORE_COUNT, filteredTags.length));
    }
  }, [hasMore, filteredTags.length]);

  // Reset visible count when search changes
  useEffect(() => {
    setVisibleCount(INITIAL_LOAD);
  }, [searchTerm]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (error) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Failed to load hashtag data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Hash className="h-6 w-6" />
          Hashtag Explorer
        </h2>
        <p className="text-muted-foreground mt-1">
          Discover trending topics and explore hashtag communities
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search hashtags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Hashtag Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(20)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-square" />
              <CardContent className="p-3">
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : visibleTags.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Hash className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchTerm ? 'No hashtags found matching your search' : 'No hashtags found'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {visibleTags.map((stat) => (
              <HashtagCard
                key={stat.tag}
                stat={stat}
                thumbnailUrl={thumbnailMap.get(stat.tag)}
              />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={loadMoreRef} className="py-8 flex justify-center">
            {hasMore ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-sm text-muted-foreground">
                Showing all {filteredTags.length} hashtags
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
