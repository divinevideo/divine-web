// ABOUTME: Category feed page showing videos filtered by content category
// ABOUTME: Displays category emoji, name, video count header with sort and view controls

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { SmartLink } from '@/components/SmartLink';
import { ArrowLeft, GridFour as Grid3X3, List, Rss } from '@phosphor-icons/react';
import { useHead, useSeoMeta } from '@unhead/react';
import { feedUrls } from '@/lib/feedUrls';
import { useRssFeedAvailable } from '@/hooks/useRssFeedAvailable';
import { VideoFeed } from '@/components/VideoFeed';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { SortMode } from '@/types/nostr';
import { EXTENDED_SORT_MODES as SORT_MODES } from '@/lib/constants/sortModes';
import { getCategoryConfig } from '@/lib/constants/categories';

type ViewMode = 'feed' | 'grid';

export function CategoryPage() {
  const { name } = useParams<{ name: string }>();
  const categoryName = name || '';
  const config = getCategoryConfig(categoryName);
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [sortMode, setSortMode] = useState<SortMode | undefined>('classic');

  const displayName = config?.label || categoryName;
  const emoji = config?.emoji || '';

  // RSS auto-discovery link for feed readers (only if feed endpoints exist)
  const rssFeedAvailable = useRssFeedAvailable();
  useHead({
    link: rssFeedAvailable && categoryName ? [
      {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: `${displayName} Videos - Divine`,
        href: feedUrls.category(categoryName),
      },
    ] : [],
  });

  useSeoMeta({
    title: `${displayName} Videos - Divine`,
    description: `Explore ${displayName.toLowerCase()} videos on Divine`,
    ogTitle: `${displayName} Videos - Divine`,
    ogDescription: `Explore ${displayName.toLowerCase()} videos on Divine`,
    ogImage: '/og.avif',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: `${displayName} Videos - Divine`,
    twitterDescription: `Explore ${displayName.toLowerCase()} videos on Divine`,
    twitterImage: '/og.avif',
  });

  if (!categoryName.trim()) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-xl font-semibold mb-4">Invalid Category</h2>
              <p className="text-muted-foreground">
                No category specified in the URL
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="flex items-center gap-4">
          <SmartLink
            to="/discovery"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Discovery
          </SmartLink>
        </div>

        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {emoji && <span className="text-3xl">{emoji}</span>}
              <div>
                <h1 className="text-3xl font-bold">{displayName}</h1>
                <p className="text-muted-foreground">
                  {displayName} videos on Divine
                </p>
              </div>
            </div>
            {rssFeedAvailable && (
              <a
                href={feedUrls.category(categoryName)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Rss className="h-3.5 w-3.5" /> RSS
              </a>
            )}
          </div>

          {/* View Toggle and Sort Selector */}
          <div className="flex items-center justify-between gap-4">
            <div
              className="flex items-center bg-muted rounded-lg p-1"
              role="group"
              aria-label="View mode selection"
            >
              <Button
                variant={viewMode === 'feed' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('feed')}
                className={cn('text-xs', viewMode === 'feed' && 'brand-offset-shadow-sm-dark')}
                aria-pressed={viewMode === 'feed'}
              >
                <List className="h-4 w-4 mr-1" />
                Feed
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className={cn('text-xs', viewMode === 'grid' && 'brand-offset-shadow-sm-dark')}
                aria-pressed={viewMode === 'grid'}
              >
                <Grid3X3 className="h-4 w-4 mr-1" />
                Grid
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort:</span>
              <Select
                value={sortMode || 'recent'}
                onValueChange={(value) => setSortMode(value === 'recent' ? undefined : value as SortMode)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_MODES.map(mode => (
                    <SelectItem key={mode.value || 'recent'} value={mode.value || 'recent'}>
                      <div className="flex items-center gap-2">
                        <mode.icon className="h-4 w-4" />
                        {mode.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Video Feed */}
        <VideoFeed
          feedType="category"
          category={categoryName}
          sortMode={sortMode}
          viewMode={viewMode}
          data-testid="video-feed-category"
          className={viewMode === 'grid' ? '' : 'space-y-6'}
        />
      </div>
    </div>
  );
}

export default CategoryPage;
