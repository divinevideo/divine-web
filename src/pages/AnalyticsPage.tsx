// ABOUTME: Creator Analytics dashboard showing video performance KPIs and top content
// ABOUTME: Auth-gated page with KPI cards, top videos list, loading skeletons, and empty state

import { Link, Navigate } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { BarChart3, Video, Eye, Heart, Users, MessageCircle, Repeat2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCreatorAnalytics } from '@/hooks/useCreatorAnalytics';
import type { VideoPerformance, CreatorKPIs } from '@/types/creatorAnalytics';
import { nip19 } from 'nostr-tools';

// --- Formatting helpers ---

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// --- KPI Card ---

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
}

function KpiCard({ title, value, icon }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// --- KPI Grid ---

function KpiGrid({ kpis, followerCount }: { kpis: CreatorKPIs; followerCount: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard
        title="Total Videos"
        value={formatCompact(kpis.totalVideos)}
        icon={<Video className="h-5 w-5" />}
      />
      <KpiCard
        title="Total Views"
        value={kpis.hasViewData ? formatCompact(kpis.totalViews) : '--'}
        icon={<Eye className="h-5 w-5" />}
      />
      <KpiCard
        title="Total Reactions"
        value={formatCompact(kpis.totalReactions)}
        icon={<Heart className="h-5 w-5" />}
      />
      <KpiCard
        title="Followers"
        value={formatCompact(followerCount)}
        icon={<Users className="h-5 w-5" />}
      />
    </div>
  );
}

// --- Top Content Row ---

function TopVideoRow({ video, rank }: { video: VideoPerformance; rank: number }) {
  const rankColors: Record<number, string> = {
    1: 'bg-brand-yellow text-brand-dark-green',
    2: 'bg-brand-violet-light text-brand-dark-green',
    3: 'bg-brand-orange text-brand-dark-green',
  };
  const rankColor = rankColors[rank] ?? 'bg-muted text-muted-foreground';

  return (
    <Link
      to={`/video/${video.eventId}`}
      className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted"
    >
      {/* Rank badge */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-sm ${rankColor}`}>
        {rank}
      </div>

      {/* Thumbnail */}
      {video.thumbnail ? (
        <img
          src={video.thumbnail}
          alt=""
          className="h-14 w-20 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded bg-muted">
          <Video className="h-5 w-5 text-muted-foreground" />
        </div>
      )}

      {/* Title + stats */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{video.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {video.hasViewData && (
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatCompact(video.views)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {formatCompact(video.reactions)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {formatCompact(video.comments)}
          </span>
          <span className="flex items-center gap-1">
            <Repeat2 className="h-3 w-3" />
            {formatCompact(video.reposts)}
          </span>
        </div>
      </div>
    </Link>
  );
}

// --- Loading Skeletons ---

function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[1, 2, 3, 4].map(i => (
        <Card key={i}>
          <CardContent className="flex items-center gap-4 p-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-12" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TopContentSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-14 w-20 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Empty State ---

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Video className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">No videos yet</h3>
        <p className="mt-1 text-muted-foreground">
          Post your first video to start seeing analytics here.
        </p>
      </div>
    </div>
  );
}

// --- Error State ---

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-muted-foreground">Failed to load analytics</p>
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Try Again
      </button>
    </div>
  );
}

// --- Main Page ---

export function AnalyticsPage() {
  const { user } = useCurrentUser();

  useSeoMeta({
    title: 'Creator Analytics - diVine',
    description: 'View your video performance metrics and engagement analytics',
    ogTitle: 'Creator Analytics - diVine',
    ogDescription: 'Track your video performance on diVine',
  });

  // Redirect to home if not logged in
  if (!user?.pubkey) {
    return <Navigate to="/" replace />;
  }

  return <AnalyticsDashboard pubkey={user.pubkey} />;
}

function AnalyticsDashboard({ pubkey }: { pubkey: string }) {
  const { data, isLoading, error, refetch } = useCreatorAnalytics(pubkey);

  // Build profile link for "View Profile" action
  let profilePath: string;
  try {
    profilePath = `/profile/${nip19.npubEncode(pubkey)}`;
  } catch {
    profilePath = `/profile/${pubkey}`;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Analytics</h1>
              <p className="text-muted-foreground">Your video performance</p>
            </div>
          </div>
          <Link
            to={profilePath}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            View Profile
          </Link>
        </div>

        {/* Loading State */}
        {isLoading && (
          <>
            <KpiGridSkeleton />
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Content</CardTitle>
              </CardHeader>
              <CardContent>
                <TopContentSkeleton />
              </CardContent>
            </Card>
          </>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <ErrorState
            message={error instanceof Error ? error.message : 'Unknown error'}
            onRetry={() => refetch()}
          />
        )}

        {/* Data State */}
        {data && !isLoading && (
          <>
            {data.kpis.totalVideos === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* KPI Summary Cards */}
                <KpiGrid kpis={data.kpis} followerCount={data.followerCount} />

                {/* Top Content */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top Content</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {data.topVideos.length > 0 ? (
                      data.topVideos.map((video, index) => (
                        <TopVideoRow
                          key={video.eventId}
                          video={video}
                          rank={index + 1}
                        />
                      ))
                    ) : (
                      <p className="py-8 text-center text-muted-foreground">
                        No engagement data yet
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AnalyticsPage;
