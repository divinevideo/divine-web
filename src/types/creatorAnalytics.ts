// ABOUTME: TypeScript types for the Creator Analytics dashboard
// ABOUTME: Defines interfaces for KPI summaries, per-video performance, and aggregated data

/**
 * Per-video performance row in the "Top videos" list.
 */
export interface VideoPerformance {
  eventId: string;
  dTag: string;
  title: string;
  thumbnail?: string;
  createdAt: number;
  views: number;
  hasViewData: boolean;
  reactions: number;
  comments: number;
  reposts: number;
  totalEngagement: number; // reactions + comments + reposts
}

/**
 * Aggregated KPI summary across the creator's full catalogue (server-computed,
 * not capped by frontend pagination).
 */
export interface CreatorKPIs {
  totalVideos: number;
  totalViews: number;
  hasViewData: boolean;
  totalReactions: number;
  totalComments: number;
  totalReposts: number;
  totalEngagement: number;
}

/**
 * Supported analytics windows. Mirrors the backend's accepted values.
 */
export type CreatorAnalyticsWindow = '7d' | '28d' | '30d' | '90d' | 'all';

/**
 * Full analytics data returned by the useCreatorAnalytics hook.
 */
export interface CreatorAnalyticsData {
  kpis: CreatorKPIs;
  topVideos: VideoPerformance[];
  followerCount: number;
  followingCount: number;
  window: CreatorAnalyticsWindow;
  fetchedAt: Date;
}
