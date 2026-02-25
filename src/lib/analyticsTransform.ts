// ABOUTME: Pure transform functions for Creator Analytics dashboard
// ABOUTME: Computes KPIs, ranks top content, and maps API data to analytics types

import type { FunnelcakeVideoRaw } from '@/types/funnelcake';
import type { FunnelcakeBulkStatsResponse } from '@/lib/funnelcakeClient';
import type { FunnelcakeProfile } from '@/lib/funnelcakeClient';
import type {
  VideoPerformance,
  CreatorKPIs,
  CreatorAnalyticsData,
} from '@/types/creatorAnalytics';

/**
 * A video enriched with its bulk stats, ready for analytics computation
 */
interface EnrichedVideo {
  video: FunnelcakeVideoRaw;
  stats: {
    reactions: number;
    comments: number;
    reposts: number;
    views?: number;
    loops?: number;
  } | null;
}

/**
 * Merge user videos with their bulk stats by event ID
 * Returns enriched videos with stats attached
 */
export function mergeVideosWithStats(
  videos: FunnelcakeVideoRaw[],
  bulkStats: FunnelcakeBulkStatsResponse,
): EnrichedVideo[] {
  const statsMap = new Map(
    bulkStats.stats.map(s => [s.id, s]),
  );

  return videos.map(video => ({
    video,
    stats: statsMap.get(video.id) ?? null,
  }));
}

/**
 * Convert an enriched video to a VideoPerformance record
 */
export function toVideoPerformance(enriched: EnrichedVideo): VideoPerformance {
  const { video, stats } = enriched;

  // Prefer bulk stats, fall back to video-level counts
  const reactions = stats?.reactions ?? video.reactions ?? video.embedded_likes ?? 0;
  const comments = stats?.comments ?? video.comments ?? video.embedded_comments ?? 0;
  const reposts = stats?.reposts ?? video.reposts ?? video.embedded_reposts ?? 0;
  const views = stats?.views ?? 0;
  const hasViewData = stats?.views != null && stats.views > 0;

  return {
    eventId: video.id,
    dTag: video.d_tag,
    title: video.title || 'Untitled',
    thumbnail: video.thumbnail,
    createdAt: video.created_at,
    views,
    hasViewData,
    reactions,
    comments,
    reposts,
    totalEngagement: reactions + comments + reposts,
  };
}

/**
 * Compute aggregate KPIs from a list of video performances
 */
export function computeKPIs(videos: VideoPerformance[]): CreatorKPIs {
  let totalViews = 0;
  let totalReactions = 0;
  let totalComments = 0;
  let totalReposts = 0;
  let hasViewData = false;

  for (const v of videos) {
    totalViews += v.views;
    totalReactions += v.reactions;
    totalComments += v.comments;
    totalReposts += v.reposts;
    if (v.hasViewData) hasViewData = true;
  }

  return {
    totalVideos: videos.length,
    totalViews,
    hasViewData,
    totalReactions,
    totalComments,
    totalReposts,
    totalEngagement: totalReactions + totalComments + totalReposts,
  };
}

/**
 * Rank videos by total engagement, return top N
 */
export function rankTopContent(
  videos: VideoPerformance[],
  limit: number = 10,
): VideoPerformance[] {
  return [...videos]
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, limit);
}

/**
 * Build complete analytics data from raw API responses
 * This is the main orchestration function called by the hook
 */
export function buildAnalyticsData(
  videos: FunnelcakeVideoRaw[],
  bulkStats: FunnelcakeBulkStatsResponse,
  profile: FunnelcakeProfile | null,
): CreatorAnalyticsData {
  const enriched = mergeVideosWithStats(videos, bulkStats);
  const performances = enriched.map(toVideoPerformance);
  const kpis = computeKPIs(performances);
  const topVideos = rankTopContent(performances, 10);

  return {
    kpis,
    topVideos,
    followerCount: profile?.follower_count ?? 0,
    followingCount: profile?.following_count ?? 0,
    fetchedAt: new Date(),
  };
}
