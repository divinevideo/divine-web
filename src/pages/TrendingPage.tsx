// ABOUTME: Trending feed page showing popular videos with multiple sort modes
// ABOUTME: Supports NIP-50 search modes: hot, top, rising, controversial

import { useState } from 'react';
import { Rss } from 'lucide-react';
import { useHead } from '@unhead/react';
import { VideoFeed } from '@/components/VideoFeed';
import { feedUrls } from '@/lib/feedUrls';
import { useRssFeedAvailable } from '@/hooks/useRssFeedAvailable';
import type { SortMode } from '@/types/nostr';
import { EXTENDED_SORT_MODES as SORT_MODES } from '@/lib/constants/sortModes';
import { AppPage, AppPageHeader } from '@/components/AppPage';
import { DiscoverySectionNav } from '@/components/DiscoverySectionNav';
import { cn } from '@/lib/utils';

export function TrendingPage() {
  const [sortMode, setSortMode] = useState<SortMode>('hot');

  // RSS auto-discovery link for feed readers (only if feed endpoints exist)
  const rssFeedAvailable = useRssFeedAvailable();
  useHead({
    link: rssFeedAvailable ? [
      {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: 'DiVine - Trending',
        href: feedUrls.trending(),
      },
    ] : [],
  });

  return (
    <AppPage width="feed">
      <AppPageHeader
        eyebrow="Fast-moving network signals"
        title="Trending"
        description="See what is breaking out across the community right now."
        actions={rssFeedAvailable ? (
          <a
            href={feedUrls.trending()}
            target="_blank"
            rel="noopener noreferrer"
            className="app-chip"
          >
            <Rss className="h-3.5 w-3.5" />
            <span>RSS</span>
          </a>
        ) : undefined}
      >
        <DiscoverySectionNav active="trending" />
      </AppPageHeader>

      <div className="app-chip-row">
        <div className="flex gap-2 pb-2">
          {SORT_MODES.map(mode => {
            const ModeIcon = mode.icon;
            const isSelected = sortMode === mode.value;
            return (
              <button
                key={mode.value}
                onClick={() => setSortMode(mode.value as SortMode)}
                className={cn('app-chip min-w-fit', isSelected && 'app-chip-active')}
              >
                <ModeIcon className="h-4 w-4" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <VideoFeed
        feedType="trending"
        sortMode={sortMode}
        data-testid="video-feed-trending"
        className="space-y-6"
      />
    </AppPage>
  );
}

export default TrendingPage;
