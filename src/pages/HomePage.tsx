// ABOUTME: Home feed page showing videos from people you follow
// ABOUTME: Requires user to be logged in and have a follow list

import { useState } from 'react';
import { nip19 } from 'nostr-tools';
import { useHead } from '@unhead/react';
import { VideoFeed } from '@/components/VideoFeed';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useFollowList } from '@/hooks/useFollowList';
import { LoginArea } from '@/components/auth/LoginArea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import { feedUrls } from '@/lib/feedUrls';
import { useRssFeedAvailable } from '@/hooks/useRssFeedAvailable';
import type { SortMode } from '@/types/nostr';
import { SORT_MODES } from '@/lib/constants/sortModes';
import { AppPage, AppPageHeader } from '@/components/AppPage';

export function HomePage() {
  const { user } = useCurrentUser();
  const { data: followList, isLoading, isFetching, dataUpdatedAt } = useFollowList();
  const [sortMode, setSortMode] = useState<SortMode | undefined>(undefined);

  // RSS auto-discovery link for feed readers (only if feed endpoints exist)
  const rssFeedAvailable = useRssFeedAvailable();
  const userNpub = user?.pubkey ? nip19.npubEncode(user.pubkey) : '';
  useHead({
    link: rssFeedAvailable ? [
      {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: 'DiVine - Latest Videos',
        href: feedUrls.latest(),
      },
      ...(userNpub ? [{
        rel: 'alternate' as const,
        type: 'application/rss+xml',
        title: 'Your Feed - diVine',
        href: feedUrls.userFeed(userNpub),
      }] : []),
    ] : [],
  });

  // Check if data is from cache (not currently fetching but has data)
  const isShowingCachedData = !isLoading && !isFetching && !!followList && followList.length > 0;
  const cacheAge = dataUpdatedAt ? Date.now() - dataUpdatedAt : 0;
  const isStale = cacheAge > 60000; // More than 1 minute old

  if (!user) {
    return (
      <AppPage width="feed">
        <AppPageHeader
          eyebrow="Private feed"
          title="Home"
          description="Sign in to see videos from people you follow."
        />
        <Card className="app-surface">
          <CardContent className="py-12 text-center">
            <h2 className="mb-4 text-xl font-semibold">Welcome to your home feed</h2>
            <p className="mb-6 text-muted-foreground">
              Sign in to see videos from people you follow.
            </p>
            <LoginArea className="mx-auto max-w-60" />
          </CardContent>
        </Card>
      </AppPage>
    );
  }

  const selectedMode = SORT_MODES.find(m => m.value === sortMode);

  return (
    <AppPage width="feed">
      <AppPageHeader
        eyebrow="Following feed"
        title="Home"
        description={(
          <>
            Videos from people you follow
            {isShowingCachedData && isStale ? (
              <span className="ml-2 text-xs opacity-70">Updating...</span>
            ) : null}
          </>
        )}
        actions={isFetching ? <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" /> : undefined}
      >
        <div className="app-surface flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="text-sm font-medium text-muted-foreground">Sort feed</span>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={sortMode || 'recent'}
              onValueChange={(value) => setSortMode(value === 'recent' ? undefined : value as SortMode)}
            >
              <SelectTrigger className="w-full rounded-full border-white/50 bg-[hsl(var(--surface-1)/0.86)] sm:w-[190px] dark:border-white/10">
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
            {selectedMode ? (
              <span className="text-xs text-muted-foreground sm:max-w-[16rem]">
                {selectedMode.description}
              </span>
            ) : null}
          </div>
        </div>
      </AppPageHeader>

      <VideoFeed
        feedType="home"
        sortMode={sortMode}
        data-testid="video-feed-home"
        className="space-y-6"
      />
    </AppPage>
  );
}

export default HomePage;
