// ABOUTME: Category feed page showing videos filtered by content category
// ABOUTME: Displays category emoji, name, video count header with sort and view controls

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { SmartLink } from '@/components/SmartLink';
import { ArrowLeft, Grid3X3, List, Rss } from 'lucide-react';
import { useHead, useSeoMeta } from '@unhead/react';
import { feedUrls } from '@/lib/feedUrls';
import { useRssFeedAvailable } from '@/hooks/useRssFeedAvailable';
import { VideoFeed } from '@/components/VideoFeed';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SortMode } from '@/types/nostr';
import { EXTENDED_SORT_MODES as SORT_MODES } from '@/lib/constants/sortModes';
import { getCategoryConfig } from '@/lib/constants/categories';
import { AppPage, AppPageHeader } from '@/components/AppPage';
import { DiscoverySectionNav } from '@/components/DiscoverySectionNav';

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
        title: `${displayName} Videos - diVine`,
        href: feedUrls.category(categoryName),
      },
    ] : [],
  });

  useSeoMeta({
    title: `${displayName} Videos - diVine`,
    description: `Explore ${displayName.toLowerCase()} videos on diVine`,
    ogTitle: `${displayName} Videos - diVine`,
    ogDescription: `Explore ${displayName.toLowerCase()} videos on diVine`,
    ogImage: '/og.avif',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: `${displayName} Videos - diVine`,
    twitterDescription: `Explore ${displayName.toLowerCase()} videos on diVine`,
    twitterImage: '/og.avif',
  });

  if (!categoryName.trim()) {
    return (
      <AppPage width="detail">
        <Card className="app-surface">
          <CardContent className="py-12 text-center">
            <h2 className="mb-4 text-xl font-semibold">Invalid Category</h2>
            <p className="text-muted-foreground">
              No category specified in the URL
            </p>
          </CardContent>
        </Card>
      </AppPage>
    );
  }

  return (
    <AppPage width="wide">
      <AppPageHeader
        eyebrow={emoji ? 'Curated topic feed' : 'Topic feed'}
        title={(
          <span className="flex items-center gap-3">
            {emoji ? <span className="text-3xl">{emoji}</span> : null}
            <span>{displayName}</span>
          </span>
        )}
        description={`${displayName} videos on diVine`}
        actions={rssFeedAvailable ? (
          <a
            href={feedUrls.category(categoryName)}
            target="_blank"
            rel="noopener noreferrer"
            className="app-chip"
          >
            <Rss className="h-3.5 w-3.5" />
            <span>RSS</span>
          </a>
        ) : undefined}
      >
        <DiscoverySectionNav active="categories" />
        <div className="flex items-center gap-4">
          <SmartLink
            to="/category"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Browse all categories
          </SmartLink>
        </div>
      </AppPageHeader>

      <div className="app-surface flex flex-col gap-4 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
        <div
          className="app-surface-muted inline-flex items-center gap-1 self-start px-1 py-1"
          role="group"
          aria-label="View mode selection"
        >
          <Button
            variant={viewMode === 'feed' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('feed')}
            className="text-xs"
            aria-pressed={viewMode === 'feed'}
          >
            <List className="mr-1 h-4 w-4" />
            Feed
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="text-xs"
            aria-pressed={viewMode === 'grid'}
          >
            <Grid3X3 className="mr-1 h-4 w-4" />
            Grid
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-sm text-muted-foreground">Sort</span>
          <Select
            value={sortMode || 'recent'}
            onValueChange={(value) => setSortMode(value === 'recent' ? undefined : value as SortMode)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
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

      <VideoFeed
        feedType="category"
        category={categoryName}
        sortMode={sortMode}
        viewMode={viewMode}
        data-testid="video-feed-category"
        className={viewMode === 'grid' ? '' : 'space-y-6'}
      />
    </AppPage>
  );
}

export default CategoryPage;
