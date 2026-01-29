// ABOUTME: Enhanced hashtag feed page with sort modes and video count
// ABOUTME: Uses Funnelcake REST API for efficient hashtag video queries

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Grid3X3, List } from 'lucide-react';
import { useSeoMeta } from '@unhead/react';
import { VideoFeed } from '@/components/VideoFeed';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SortMode } from '@/types/nostr';
import { EXTENDED_SORT_MODES as SORT_MODES } from '@/lib/constants/sortModes';

type ViewMode = 'feed' | 'grid';

export function HashtagPage() {
  const { tag } = useParams<{ tag: string }>();
  const normalizedTag = (tag || '').toLowerCase();
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [sortMode, setSortMode] = useState<SortMode>('hot');

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
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-xl font-semibold mb-4">Invalid Hashtag</h2>
              <p className="text-muted-foreground">
                No hashtag specified in the URL
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
          <Link
            to="/hashtags"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Discovery
          </Link>
        </div>

        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">#{tag}</h1>
              <p className="text-muted-foreground">Videos tagged with #{tag}</p>
            </div>
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
                className="text-xs"
                role="button"
                aria-pressed={viewMode === 'feed'}
              >
                <List className="h-4 w-4 mr-1" />
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
                <Grid3X3 className="h-4 w-4 mr-1" />
                Grid
              </Button>
            </div>

            {/* Sort mode selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort:</span>
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger className="w-[140px]">
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
        </div>

        {/* Video Feed with sort mode */}
        <VideoFeed
          feedType="hashtag"
          hashtag={normalizedTag}
          sortMode={sortMode}
          viewMode={viewMode}
          data-testid="video-feed-hashtag"
          data-hashtag-testid={`feed-hashtag-${normalizedTag}`}
          className={viewMode === 'grid' ? '' : 'space-y-6'}
        />
      </div>
    </div>
  );
}

export default HashtagPage;
