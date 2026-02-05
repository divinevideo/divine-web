// ABOUTME: Trending feed page showing popular videos with multiple sort modes
// ABOUTME: Supports NIP-50 search modes: hot, top, rising, controversial

import { useState } from 'react';
import { VideoFeed } from '@/components/VideoFeed';
import type { SortMode } from '@/types/nostr';
import { EXTENDED_SORT_MODES as SORT_MODES } from '@/lib/constants/sortModes';

export function TrendingPage() {
  const [sortMode, setSortMode] = useState<SortMode>('hot');

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6 space-y-4">
          <div>
            <h1 className="text-2xl font-bold">Trending</h1>
            <p className="text-muted-foreground">
              Discover what's popular in the community
            </p>
          </div>

          {/* Sort mode selector as prominent tabs/buttons */}
          <div className="flex flex-wrap gap-2">
            {SORT_MODES.map(mode => {
              const ModeIcon = mode.icon;
              const isSelected = sortMode === mode.value;
              return (
                <button
                  key={mode.value}
                  onClick={() => setSortMode(mode.value as SortMode)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                    ${isSelected
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-brand-light-green dark:bg-brand-dark-green hover:bg-muted text-muted-foreground hover:text-foreground'
                    }
                  `}
                >
                  <ModeIcon className="h-4 w-4" />
                  <span>{mode.label}</span>
                  {isSelected && (
                    <span className="text-xs opacity-80 hidden sm:inline">
                      • {mode.description}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        <VideoFeed
          feedType="trending"
          sortMode={sortMode}
          data-testid="video-feed-trending"
          className="space-y-6"
        />
      </div>
    </div>
  );
}

export default TrendingPage;