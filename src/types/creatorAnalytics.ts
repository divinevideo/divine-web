// ABOUTME: TypeScript types for the Creator Analytics dashboard
// ABOUTME: Defines interfaces for KPI summaries, per-video performance, and aggregated data

/**
 * Per-video performance metrics for the analytics dashboard
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
 * Aggregated KPI summary across all (or filtered) videos
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
 * Full analytics data returned by the useCreatorAnalytics hook
 */
export interface CreatorAnalyticsData {
  kpis: CreatorKPIs;
  topVideos: VideoPerformance[];
  followerCount: number;
  followingCount: number;
  fetchedAt: Date;
}
