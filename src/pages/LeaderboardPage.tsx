// ABOUTME: Leaderboard page showing top videos and creators by loops/views
// ABOUTME: Supports time filters: all time, today, this week, this month, this year

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSeoMeta } from '@unhead/react';
import { Trophy, Video, User, Clock, Calendar, CalendarDays, CalendarRange, Infinity as InfinityIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_FUNNELCAKE_URL } from '@/config/relays';
import { nip19 } from 'nostr-tools';

type TimePeriod = 'alltime' | 'day' | 'week' | 'month' | 'year';
type LeaderboardType = 'videos' | 'creators';

interface VideoLeaderboardItem {
  id: string;
  pubkey: string;
  title: string;
  thumbnail?: string;
  d_tag?: string;
  video_url?: string;
  kind?: number;
  author_name?: string;
  author_avatar?: string;
  views: number;
  unique_viewers: number;
  loops: number;
}

interface CreatorLeaderboardItem {
  pubkey: string;
  name?: string;
  display_name?: string;
  picture?: string;
  views: number;
  unique_viewers: number;
  loops: number;
  videos_with_views: number;
}

function formatLoops(loops: number): string {
  // Round to nearest integer for display
  const rounded = Math.round(loops);
  if (rounded >= 1_000_000_000) {
    return `${(rounded / 1_000_000_000).toFixed(1)}B`;
  }
  if (rounded >= 1_000_000) {
    return `${(rounded / 1_000_000).toFixed(1)}M`;
  }
  if (rounded >= 1_000) {
    return `${(rounded / 1_000).toFixed(1)}K`;
  }
  return rounded.toLocaleString();
}

function getTimePeriodLabel(period: TimePeriod): string {
  switch (period) {
    case 'alltime': return 'All Time';
    case 'day': return 'Today';
    case 'week': return 'This Week';
    case 'month': return 'This Month';
    case 'year': return 'This Year';
  }
}

function getTimePeriodIcon(period: TimePeriod) {
  switch (period) {
    case 'alltime': return InfinityIcon;
    case 'day': return Clock;
    case 'week': return Calendar;
    case 'month': return CalendarDays;
    case 'year': return CalendarRange;
  }
}

function VideoLeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-brand-light-green dark:bg-brand-dark-green">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-16 w-24 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

function CreatorLeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-brand-light-green dark:bg-brand-dark-green">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors = {
    1: 'bg-brand-yellow text-brand-dark-green',
    2: 'bg-brand-violet-light text-brand-dark-green',
    3: 'bg-brand-orange text-brand-dark-green',
  };

  const color = colors[rank as keyof typeof colors] || 'bg-muted text-muted-foreground';

  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${color}`}>
      {rank}
    </div>
  );
}

function VideoLeaderboard({ period }: { period: TimePeriod }) {
  const { data: videos, isLoading, error } = useQuery({
    queryKey: ['leaderboard-videos', period],
    queryFn: async ({ signal }) => {
      // Use the dedicated leaderboard endpoint
      const params = new URLSearchParams({
        period: period,
        limit: '50',
      });

      const response = await fetch(
        `${DEFAULT_FUNNELCAKE_URL}/api/leaderboard/videos?${params}`,
        { signal }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch leaderboard');
      }

      const data = await response.json();
      // API returns { period, entries: [...] }
      const entries = (data.entries || data) as VideoLeaderboardItem[];

      // Fetch author names for videos missing them
      const pubkeysNeedingNames = [...new Set(
        entries.filter(v => !v.author_name).map(v => v.pubkey)
      )];

      if (pubkeysNeedingNames.length > 0) {
        try {
          const profilesResponse = await fetch(
            `${DEFAULT_FUNNELCAKE_URL}/api/users/bulk`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pubkeys: pubkeysNeedingNames }),
              signal,
            }
          );

          if (profilesResponse.ok) {
            const profilesData = await profilesResponse.json();
            const profileMap = new Map<string, string>();
            for (const user of profilesData.users || []) {
              const name = user.profile?.display_name || user.profile?.name;
              if (name) {
                profileMap.set(user.pubkey, name);
              }
            }

            // Merge names into entries
            for (const entry of entries) {
              if (!entry.author_name && profileMap.has(entry.pubkey)) {
                entry.author_name = profileMap.get(entry.pubkey);
              }
            }
          }
        } catch {
          // Silently fail - we'll show "Unknown" for these
        }
      }

      // Sort client-side as workaround for backend sorting bug
      return entries.sort((a, b) => (b.loops || 0) - (a.loops || 0));
    },
    staleTime: 60000, // 1 minute
    retry: 1,
  });

  if (isLoading) {
    return <VideoLeaderboardSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Failed to load leaderboard</p>
        <p className="text-sm mt-2">{error.message}</p>
      </div>
    );
  }

  if (!videos?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No videos found for this time period
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {videos.map((video, index) => {
        let npub: string;
        try {
          npub = nip19.npubEncode(video.pubkey);
        } catch {
          npub = video.pubkey;
        }

        return (
          <Link
            key={video.id}
            to={`/video/${video.id}`}
            className="flex items-center gap-4 p-3 rounded-lg hover:bg-brand-light-green dark:bg-brand-dark-green transition-colors"
          >
            <RankBadge rank={index + 1} />

            {video.thumbnail && (
              <img
                src={video.thumbnail}
                alt=""
                className="h-16 w-24 object-cover rounded"
              />
            )}

            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {video.title || 'Untitled'}
              </p>
              <Link
                to={`/profile/${npub}`}
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                {video.author_name || 'Unknown'}
              </Link>
            </div>

            <div className="text-right">
              <p className="font-bold text-lg">{formatLoops(video.loops || 0)}</p>
              <p className="text-xs text-muted-foreground">loops</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function CreatorLeaderboard({ period }: { period: TimePeriod }) {
  const { data: creators, isLoading, error } = useQuery({
    queryKey: ['leaderboard-creators', period],
    queryFn: async ({ signal }) => {
      // Use the dedicated leaderboard endpoint
      const params = new URLSearchParams({
        period: period,
        limit: '50',
      });

      const response = await fetch(
        `${DEFAULT_FUNNELCAKE_URL}/api/leaderboard/creators?${params}`,
        { signal }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch creator leaderboard');
      }

      const data = await response.json();
      // API returns { period, entries: [...] }
      const entries = (data.entries || data) as CreatorLeaderboardItem[];
      // Sort client-side as workaround for backend sorting bug
      return entries.sort((a, b) => (b.loops || 0) - (a.loops || 0));
    },
    staleTime: 60000,
    retry: 1,
  });

  if (isLoading) {
    return <CreatorLeaderboardSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Failed to load creator leaderboard</p>
        <p className="text-sm mt-2">{error.message}</p>
      </div>
    );
  }

  if (!creators?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No creators found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {creators.map((creator, index) => {
        let npub: string;
        try {
          npub = nip19.npubEncode(creator.pubkey);
        } catch {
          npub = creator.pubkey;
        }

        return (
          <Link
            key={creator.pubkey}
            to={`/profile/${npub}`}
            className="flex items-center gap-4 p-3 rounded-lg hover:bg-brand-light-green dark:bg-brand-dark-green transition-colors"
          >
            <RankBadge rank={index + 1} />

            <Avatar className="h-12 w-12">
              <AvatarImage src={creator.picture} alt={creator.display_name || creator.name} />
              <AvatarFallback>
                {(creator.display_name || creator.name || '?')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {creator.display_name || creator.name || 'Unknown'}
              </p>
              <p className="text-sm text-muted-foreground">
                {creator.videos_with_views} videos
              </p>
            </div>

            <div className="text-right">
              <p className="font-bold text-lg">{formatLoops(creator.loops || 0)}</p>
              <p className="text-xs text-muted-foreground">total loops</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function LeaderboardPage() {
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('videos');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('alltime');

  useSeoMeta({
    title: 'Leaderboard - diVine',
    description: 'Top videos and creators by loops on diVine',
    ogTitle: 'Leaderboard - diVine',
    ogDescription: 'See the most popular videos and creators',
  });

  const TimePeriodIcon = useMemo(() => getTimePeriodIcon(timePeriod), [timePeriod]);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold">Leaderboard</h1>
            <p className="text-muted-foreground">Top videos and creators by loops</p>
          </div>
        </div>

        {/* Main tabs: Videos vs Creators */}
        <Tabs value={leaderboardType} onValueChange={(v) => setLeaderboardType(v as LeaderboardType)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="videos" className="gap-2">
              <Video className="h-4 w-4" />
              Top Videos
            </TabsTrigger>
            <TabsTrigger value="creators" className="gap-2">
              <User className="h-4 w-4" />
              Top Creators
            </TabsTrigger>
          </TabsList>

          {/* Time period selector */}
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TimePeriodIcon className="h-4 w-4" />
                {getTimePeriodLabel(timePeriod)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {(['alltime', 'day', 'week', 'month', 'year'] as TimePeriod[]).map((period) => {
                  const Icon = getTimePeriodIcon(period);
                  return (
                    <button
                      key={period}
                      onClick={() => setTimePeriod(period)}
                      className={`
                        px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                        flex items-center gap-1.5
                        ${timePeriod === period
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-brand-light-green dark:hover:bg-brand-dark-green text-muted-foreground'
                        }
                      `}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {getTimePeriodLabel(period)}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard content */}
          <TabsContent value="videos" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <VideoLeaderboard period={timePeriod} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="creators" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <CreatorLeaderboard period={timePeriod} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default LeaderboardPage;
