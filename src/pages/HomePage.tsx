// ABOUTME: Home feed page showing videos from people you follow
// ABOUTME: Requires user to be logged in and have a follow list

import { useState } from 'react';
import { VideoFeed } from '@/components/VideoFeed';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useFollowList } from '@/hooks/useFollowList';
import { LoginArea } from '@/components/auth/LoginArea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import type { SortMode } from '@/types/nostr';
import { SORT_MODES } from '@/lib/constants/sortModes';

export function HomePage() {
  const { user } = useCurrentUser();
  const { data: followList, isLoading, isFetching, dataUpdatedAt } = useFollowList();
  const [sortMode, setSortMode] = useState<SortMode | undefined>(undefined);

  // Check if data is from cache (not currently fetching but has data)
  const isShowingCachedData = !isLoading && !isFetching && !!followList && followList.length > 0;
  const cacheAge = dataUpdatedAt ? Date.now() - dataUpdatedAt : 0;
  const isStale = cacheAge > 60000; // More than 1 minute old

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-xl font-semibold mb-4">Welcome to Your Home Feed</h2>
              <p className="text-muted-foreground mb-6">
                Sign in to see videos from people you follow
              </p>
              <LoginArea className="max-w-60 mx-auto" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const selectedMode = SORT_MODES.find(m => m.value === sortMode);

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6 space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Home</h1>
              {isFetching && (
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-muted-foreground">
              Videos from people you follow
              {isShowingCachedData && isStale && (
                <span className="text-xs ml-2 opacity-70">
                  • Updating...
                </span>
              )}
            </p>
          </div>

          {/* Sort mode selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Select
              value={sortMode || 'recent'}
              onValueChange={(value) => setSortMode(value === 'recent' ? undefined : value as SortMode)}
            >
              <SelectTrigger className="w-[160px]">
                <div className="flex items-center gap-2">
                  {selectedMode && <selectedMode.icon className="h-4 w-4" />}
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {SORT_MODES.map(mode => (
                  <SelectItem key={mode.value || 'recent'} value={mode.value || 'recent'}>
                    <div className="flex items-center gap-2">
                      <mode.icon className="h-4 w-4" />
                      <span>{mode.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedMode && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                • {selectedMode.description}
              </span>
            )}
          </div>
        </header>

        <VideoFeed
          feedType="home"
          sortMode={sortMode}
          data-testid="video-feed-home"
          className="space-y-6"
        />
      </div>
    </div>
  );
}

export default HomePage;