// ABOUTME: Unit tests for Creator Analytics transform functions
// ABOUTME: Tests kpisFromAnalytics, topPostToPerformance, and buildAnalyticsData

import { describe, it, expect } from 'vitest';
import {
  kpisFromAnalytics,
  topPostToPerformance,
  buildAnalyticsData,
} from './analyticsTransform';
import type {
  FunnelcakeVideoRaw,
  FunnelcakeCreatorAnalyticsResponse,
  FunnelcakeCreatorTopPost,
} from '@/types/funnelcake';
import type { FunnelcakeProfile } from '@/lib/funnelcakeClient';

function makeAnalytics(
  overrides: Partial<FunnelcakeCreatorAnalyticsResponse> = {},
): FunnelcakeCreatorAnalyticsResponse {
  return {
    total_views: 0,
    total_loops: 0,
    total_watch_time: 0,
    unique_viewers: 0,
    period: '30d',
    pubkey: 'pk-1',
    window: '30d',
    summary: {
      video_count: 0,
      views: 0,
      unique_viewers: 0,
      reactions: 0,
      comments: 0,
      reposts: 0,
      has_view_data: false,
    },
    timeseries: {
      daily_views: [],
      daily_interactions: [],
      daily_follows: [],
    },
    top_posts: [],
    ...overrides,
  };
}

function makeVideo(overrides: Partial<FunnelcakeVideoRaw> = {}): FunnelcakeVideoRaw {
  return {
    id: 'vid-1',
    pubkey: 'pk-1',
    created_at: 1700000000,
    kind: 34236,
    d_tag: 'd-1',
    title: 'Test Video',
    video_url: 'https://example.com/video.mp4',
    ...overrides,
  };
}

describe('kpisFromAnalytics', () => {
  it('reads summary totals, not derived from top_posts', () => {
    const analytics = makeAnalytics({
      summary: {
        video_count: 247,
        views: 18_000,
        unique_viewers: 9_000,
        reactions: 600,
        comments: 120,
        reposts: 30,
        has_view_data: true,
      },
      top_posts: [
        { id: 'a', views: 5_000, engagement_rate: 0.08 },
      ],
    });

    const kpis = kpisFromAnalytics(analytics);

    // totalVideos reflects the full catalogue (247), not top_posts.length (1)
    expect(kpis.totalVideos).toBe(247);
    expect(kpis.totalViews).toBe(18_000);
    expect(kpis.hasViewData).toBe(true);
    expect(kpis.totalReactions).toBe(600);
    expect(kpis.totalComments).toBe(120);
    expect(kpis.totalReposts).toBe(30);
    expect(kpis.totalEngagement).toBe(750);
  });

  it('falls back to total_views when summary.views is null', () => {
    const analytics = makeAnalytics({
      total_views: 42,
      summary: {
        video_count: 1,
        views: null,
        reactions: 0,
        comments: 0,
        reposts: 0,
        has_view_data: false,
      },
    });

    expect(kpisFromAnalytics(analytics).totalViews).toBe(42);
  });

  it('returns zeros for an empty creator', () => {
    const kpis = kpisFromAnalytics(makeAnalytics());
    expect(kpis.totalVideos).toBe(0);
    expect(kpis.totalViews).toBe(0);
    expect(kpis.hasViewData).toBe(false);
    expect(kpis.totalEngagement).toBe(0);
  });
});

describe('topPostToPerformance', () => {
  it('merges top_post metric with bulk-fetched metadata', () => {
    const post: FunnelcakeCreatorTopPost = { id: 'v1', views: 1_000, engagement_rate: 0.08 };
    const video = makeVideo({
      id: 'v1',
      title: 'My Vine',
      thumbnail: 'https://cdn/x.jpg',
      reactions: 42,
      comments: 7,
      reposts: 3,
    });

    const perf = topPostToPerformance(post, new Map([[video.id, video]]));

    expect(perf.eventId).toBe('v1');
    expect(perf.title).toBe('My Vine');
    expect(perf.thumbnail).toBe('https://cdn/x.jpg');
    expect(perf.views).toBe(1_000);
    expect(perf.hasViewData).toBe(true);
    expect(perf.reactions).toBe(42);
    expect(perf.comments).toBe(7);
    expect(perf.reposts).toBe(3);
    expect(perf.totalEngagement).toBe(52);
  });

  it('renders a placeholder when metadata is missing for the ID', () => {
    const post: FunnelcakeCreatorTopPost = { id: 'orphan', views: 5 };
    const perf = topPostToPerformance(post, new Map());

    expect(perf.eventId).toBe('orphan');
    expect(perf.title).toBe('Untitled');
    expect(perf.thumbnail).toBeUndefined();
    expect(perf.views).toBe(5);
    expect(perf.reactions).toBe(0);
  });

  it('treats an explicit zero-view top_post metric as view data', () => {
    const post: FunnelcakeCreatorTopPost = { id: 'zero-view', views: 0 };
    const perf = topPostToPerformance(post, new Map());

    expect(perf.views).toBe(0);
    expect(perf.hasViewData).toBe(true);
  });

  it('falls back to embedded_* counts when canonical fields are absent', () => {
    const post: FunnelcakeCreatorTopPost = { id: 'v2' };
    const video = makeVideo({
      id: 'v2',
      embedded_likes: 8,
      embedded_comments: 3,
      embedded_reposts: 2,
    });

    const perf = topPostToPerformance(post, new Map([[video.id, video]]));

    expect(perf.reactions).toBe(8);
    expect(perf.comments).toBe(3);
    expect(perf.reposts).toBe(2);
    expect(perf.hasViewData).toBe(false);
  });
});

describe('buildAnalyticsData', () => {
  it('orchestrates summary + top_posts into the dashboard payload', () => {
    const analytics = makeAnalytics({
      window: '28d',
      summary: {
        video_count: 5,
        views: 1_500,
        reactions: 30,
        comments: 10,
        reposts: 5,
        has_view_data: true,
      },
      top_posts: [
        { id: 'v1', views: 1_000 },
        { id: 'v2', views: 500 },
      ],
    });

    const meta = [
      makeVideo({ id: 'v1', title: 'First' }),
      makeVideo({ id: 'v2', title: 'Second' }),
    ];

    const profile: FunnelcakeProfile = {
      pubkey: 'pk-1',
      follower_count: 500,
      following_count: 100,
    };

    const data = buildAnalyticsData(analytics, meta, profile);

    expect(data.kpis.totalVideos).toBe(5);
    expect(data.kpis.totalViews).toBe(1_500);
    expect(data.kpis.totalReactions).toBe(30);
    expect(data.followerCount).toBe(500);
    expect(data.followingCount).toBe(100);
    expect(data.window).toBe('28d');
    expect(data.topVideos).toHaveLength(2);
    expect(data.topVideos[0].title).toBe('First');
    expect(data.topVideos[1].title).toBe('Second');
    expect(data.fetchedAt).toBeInstanceOf(Date);
  });

  it('handles a null profile and an empty top_posts list', () => {
    const data = buildAnalyticsData(makeAnalytics(), [], null);

    expect(data.followerCount).toBe(0);
    expect(data.followingCount).toBe(0);
    expect(data.kpis.totalVideos).toBe(0);
    expect(data.topVideos).toEqual([]);
  });
});
