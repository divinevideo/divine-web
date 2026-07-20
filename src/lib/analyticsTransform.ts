// ABOUTME: Pure transform functions for Creator Analytics dashboard
// ABOUTME: Maps the server-aggregated analytics response into the dashboard's shape

import type {
  FunnelcakeVideoRaw,
  FunnelcakeCreatorAnalyticsResponse,
  FunnelcakeCreatorTopPost,
} from '@/types/funnelcake';
import type { FunnelcakeProfile } from '@/lib/funnelcakeClient';
import type {
  VideoPerformance,
  CreatorKPIs,
  CreatorAnalyticsData,
  CreatorAnalyticsWindow,
} from '@/types/creatorAnalytics';

/**
 * Build the dashboard's KPI block from the server-aggregated summary.
 *
 * The summary totals span the creator's whole catalogue for the requested
 * window - they are not derived from the top_posts list and therefore are
 * correct regardless of catalogue size.
 */
export function kpisFromAnalytics(
  analytics: FunnelcakeCreatorAnalyticsResponse,
): CreatorKPIs {
  const s = analytics.summary;
  const reactions = s.reactions ?? 0;
  const comments = s.comments ?? 0;
  const reposts = s.reposts ?? 0;

  return {
    totalVideos: s.video_count ?? 0,
    totalViews: s.views ?? analytics.total_views ?? 0,
    hasViewData: s.has_view_data === true,
    totalReactions: reactions,
    totalComments: comments,
    totalReposts: reposts,
    totalEngagement: reactions + comments + reposts,
  };
}

/**
 * Merge a top_posts entry (id + a metric or two) with the full video record
 * fetched separately via bulk_videos, producing the row shape the UI renders.
 *
 * `videoById` may be missing the entry (deleted/unindexed); in that case
 * the row is rendered with the ID alone and a placeholder title.
 */
export function topPostToPerformance(
  post: FunnelcakeCreatorTopPost,
  videoById: Map<string, FunnelcakeVideoRaw>,
): VideoPerformance {
  const video = videoById.get(post.id);
  const reactions = video?.reactions ?? video?.embedded_likes ?? 0;
  const comments = video?.comments ?? video?.embedded_comments ?? 0;
  const reposts = video?.reposts ?? video?.embedded_reposts ?? 0;
  const views = post.views ?? video?.views ?? 0;

  return {
    eventId: post.id,
    dTag: video?.d_tag ?? '',
    title: video?.title || 'Untitled',
    thumbnail: video?.thumbnail,
    createdAt: video?.created_at ?? 0,
    views: views ?? 0,
    hasViewData: post.views != null,
    reactions,
    comments,
    reposts,
    totalEngagement: reactions + comments + reposts,
  };
}

/**
 * Assemble the full dashboard payload from the analytics response, the
 * bulk-fetched metadata for the top posts, and the creator's profile.
 *
 * `profile` is used solely for the follower/following counts shown on the
 * KPI cards - the summary block already carries `followers_gained` over
 * the window, but the dashboard wants the absolute count.
 */
export function buildAnalyticsData(
  analytics: FunnelcakeCreatorAnalyticsResponse,
  topVideoMetadata: FunnelcakeVideoRaw[],
  profile: FunnelcakeProfile | null,
): CreatorAnalyticsData {
  const videoById = new Map(topVideoMetadata.map(v => [v.id, v]));
  const topVideos = analytics.top_posts.map(post =>
    topPostToPerformance(post, videoById),
  );

  return {
    kpis: kpisFromAnalytics(analytics),
    topVideos,
    followerCount: profile?.follower_count ?? 0,
    followingCount: profile?.following_count ?? 0,
    window: (analytics.window || analytics.period || '30d') as CreatorAnalyticsWindow,
    fetchedAt: new Date(),
  };
}
