// ABOUTME: Enhanced hashtag feed page with sort modes and video count
// ABOUTME: Uses Funnelcake REST API for efficient hashtag video queries

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
import { AppPage, AppPageHeader } from '@/components/AppPage';
import { DiscoverySectionNav } from '@/components/DiscoverySectionNav';

type ViewMode = 'feed' | 'grid';

export function HashtagPage() {
  const { tag } = useParams<{ tag: string }>();
  const normalizedTag = (tag || '').toLowerCase();
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [sortMode, setSortMode] = useState<SortMode>('hot');

  // RSS auto-discovery link for feed readers (only if feed endpoints exist)
  const rssFeedAvailable = useRssFeedAvailable();
  useHead({
    link: rssFeedAvailable && normalizedTag ? [
      {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: `#${tag} - diVine`,
        href: feedUrls.hashtag(normalizedTag),
      },
    ] : [],
  });

  // Dynamic SEO meta tags for social sharing
  const description = `Explore videos tagged with #${tag} on diVine`;

  useSeoMeta({
    title: `#${tag} - diVine`,
    description: description,
    ogTitle: `#${tag} - diVine`,
    ogDescription: description,
    ogImage: '/og.avif',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: `#${tag} - diVine`,
    twitterDescription: description,
    twitterImage: '/og.avif',
  });

  if (!normalizedTag || normalizedTag.trim() === '') {
    return (
      <AppPage width="detail">
        <Card className="app-surface">
          <CardContent className="py-12 text-center">
            <h2 className="mb-4 text-xl font-semibold">Invalid Hashtag</h2>
            <p className="text-muted-foreground">
              No hashtag specified in the URL
            </p>
          </CardContent>
        </Card>
      </AppPage>
    );
  }

  return (
    <AppPage width="wide">
      <AppPageHeader
        eyebrow="Live hashtag stream"
        title={`#${tag}`}
        description={`Videos tagged with #${tag}`}
        actions={rssFeedAvailable ? (
          <a
            href={feedUrls.hashtag(normalizedTag)}
            target="_blank"
            rel="noopener noreferrer"
            className="app-chip"
          >
            <Rss className="h-3.5 w-3.5" />
            <span>RSS</span>
          </a>
        ) : undefined}
      >
        <DiscoverySectionNav active="hashtags" />
        <div className="flex items-center gap-4">
          <SmartLink
            to="/hashtags"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Browse all hashtags
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
            role="button"
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
            role="button"
            aria-pressed={viewMode === 'grid'}
          >
            <Grid3X3 className="mr-1 h-4 w-4" />
            Grid
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-sm text-muted-foreground">Sort</span>
          <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_MODES.map(mode => (
                <SelectItem key={mode.value} value={mode.value as string}>
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
        feedType="hashtag"
        hashtag={normalizedTag}
        sortMode={sortMode}
        viewMode={viewMode}
        data-testid="video-feed-hashtag"
        data-hashtag-testid={`feed-hashtag-${normalizedTag}`}
        className={viewMode === 'grid' ? '' : 'space-y-6'}
      />
    </AppPage>
  );
}

export default HashtagPage;
