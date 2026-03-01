// ABOUTME: Category feed page showing videos filtered by content category
// ABOUTME: Displays category emoji, name, video count header with sort and view controls

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { SmartLink } from '@/components/SmartLink';
import { ArrowLeft, Grid3X3, List } from 'lucide-react';
import { useSeoMeta } from '@unhead/react';
import { VideoFeed } from '@/components/VideoFeed';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SortMode } from '@/types/nostr';
import { EXTENDED_SORT_MODES as SORT_MODES } from '@/lib/constants/sortModes';
import { getCategoryConfig } from '@/lib/constants/categories';

type ViewMode = 'feed' | 'grid';

export function CategoryPage() {
  const { name } = useParams<{ name: string }>();
  const categoryName = name || '';
  const config = getCategoryConfig(categoryName);
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [sortMode, setSortMode] = useState<SortMode>('hot');

  const displayName = config?.label || categoryName;
  const emoji = config?.emoji || '';

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
                  {displayName} videos on diVine
                </p>
              </div>
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
                aria-pressed={viewMode === 'grid'}
              >
                <Grid3X3 className="h-4 w-4 mr-1" />
                Grid
              </Button>
            </div>

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
