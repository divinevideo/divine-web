// ABOUTME: Unit tests for Creator Analytics transform functions
// ABOUTME: Tests computeKPIs, rankTopContent, mergeVideosWithStats, and buildAnalyticsData

import { describe, it, expect } from 'vitest';
import {
  mergeVideosWithStats,
  toVideoPerformance,
  computeKPIs,
  rankTopContent,
  buildAnalyticsData,
} from './analyticsTransform';
import type { FunnelcakeVideoRaw } from '@/types/funnelcake';
import type { FunnelcakeBulkStatsResponse, FunnelcakeProfile } from '@/lib/funnelcakeClient';

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

function makeBulkStats(
  stats: Array<{ id: string; reactions?: number; comments?: number; reposts?: number; views?: number }>,
): FunnelcakeBulkStatsResponse {
  return {
    stats: stats.map(s => ({
      id: s.id,
      reactions: s.reactions ?? 0,
      comments: s.comments ?? 0,
      reposts: s.reposts ?? 0,
      views: s.views,
    })),
    missing: [],
  };
}

describe('mergeVideosWithStats', () => {
  it('merges stats by event ID', () => {
    const videos = [makeVideo({ id: 'a' }), makeVideo({ id: 'b' })];
    const stats = makeBulkStats([{ id: 'a', reactions: 10 }]);

    const result = mergeVideosWithStats(videos, stats);

    expect(result).toHaveLength(2);
    expect(result[0].stats?.reactions).toBe(10);
    expect(result[1].stats).toBeNull();
  });

  it('handles empty videos', () => {
    const result = mergeVideosWithStats([], makeBulkStats([]));
    expect(result).toHaveLength(0);
  });
});

describe('toVideoPerformance', () => {
  it('prefers bulk stats over video-level counts', () => {
    const video = makeVideo({ id: 'v1', reactions: 5, comments: 2, reposts: 1 });
    const stats = { reactions: 50, comments: 20, reposts: 10, views: 1000 };

    const result = toVideoPerformance({ video, stats });

    expect(result.reactions).toBe(50);
    expect(result.comments).toBe(20);
    expect(result.reposts).toBe(10);
    expect(result.views).toBe(1000);
    expect(result.hasViewData).toBe(true);
    expect(result.totalEngagement).toBe(80);
  });

  it('falls back to video-level counts when no stats', () => {
    const video = makeVideo({ reactions: 5, comments: 2, reposts: 1 });

    const result = toVideoPerformance({ video, stats: null });

    expect(result.reactions).toBe(5);
    expect(result.comments).toBe(2);
    expect(result.reposts).toBe(1);
    expect(result.views).toBe(0);
    expect(result.hasViewData).toBe(false);
  });

  it('falls back to embedded_* fields', () => {
    const video = makeVideo({ embedded_likes: 8, embedded_comments: 3, embedded_reposts: 2 });

    const result = toVideoPerformance({ video, stats: null });

    expect(result.reactions).toBe(8);
    expect(result.comments).toBe(3);
    expect(result.reposts).toBe(2);
  });

  it('uses video title or defaults to Untitled', () => {
    expect(toVideoPerformance({ video: makeVideo({ title: 'Cool Vid' }), stats: null }).title).toBe('Cool Vid');
    expect(toVideoPerformance({ video: makeVideo({ title: undefined }), stats: null }).title).toBe('Untitled');
  });
});

describe('computeKPIs', () => {
  it('aggregates totals across all videos', () => {
    const performances = [
      toVideoPerformance({
        video: makeVideo({ id: 'a' }),
        stats: { reactions: 10, comments: 5, reposts: 2, views: 100 },
      }),
      toVideoPerformance({
        video: makeVideo({ id: 'b' }),
        stats: { reactions: 20, comments: 10, reposts: 3, views: 200 },
      }),
    ];

    const kpis = computeKPIs(performances);

    expect(kpis.totalVideos).toBe(2);
    expect(kpis.totalViews).toBe(300);
    expect(kpis.hasViewData).toBe(true);
    expect(kpis.totalReactions).toBe(30);
    expect(kpis.totalComments).toBe(15);
    expect(kpis.totalReposts).toBe(5);
    expect(kpis.totalEngagement).toBe(50);
  });

  it('returns zeros for empty input', () => {
    const kpis = computeKPIs([]);

    expect(kpis.totalVideos).toBe(0);
    expect(kpis.totalViews).toBe(0);
    expect(kpis.hasViewData).toBe(false);
    expect(kpis.totalEngagement).toBe(0);
  });

  it('sets hasViewData false when no video has views', () => {
    const performances = [
      toVideoPerformance({ video: makeVideo(), stats: null }),
    ];

    const kpis = computeKPIs(performances);
    expect(kpis.hasViewData).toBe(false);
  });
});

describe('rankTopContent', () => {
  it('sorts by total engagement descending', () => {
    const performances = [
      toVideoPerformance({
        video: makeVideo({ id: 'low' }),
        stats: { reactions: 1, comments: 0, reposts: 0 },
      }),
      toVideoPerformance({
        video: makeVideo({ id: 'high' }),
        stats: { reactions: 100, comments: 50, reposts: 25 },
      }),
      toVideoPerformance({
        video: makeVideo({ id: 'mid' }),
        stats: { reactions: 10, comments: 5, reposts: 2 },
      }),
    ];

    const ranked = rankTopContent(performances, 3);

    expect(ranked[0].eventId).toBe('high');
    expect(ranked[1].eventId).toBe('mid');
    expect(ranked[2].eventId).toBe('low');
  });

  it('limits results to specified count', () => {
    const performances = Array.from({ length: 20 }, (_, i) =>
      toVideoPerformance({
        video: makeVideo({ id: `v${i}` }),
        stats: { reactions: i, comments: 0, reposts: 0 },
      }),
    );

    const ranked = rankTopContent(performances, 5);
    expect(ranked).toHaveLength(5);
  });

  it('returns empty array for empty input', () => {
    expect(rankTopContent([])).toEqual([]);
  });
});

describe('buildAnalyticsData', () => {
  it('orchestrates all transforms into final analytics data', () => {
    const videos = [
      makeVideo({ id: 'v1', title: 'First' }),
      makeVideo({ id: 'v2', title: 'Second' }),
    ];

    const bulkStats = makeBulkStats([
      { id: 'v1', reactions: 10, comments: 5, reposts: 2, views: 100 },
      { id: 'v2', reactions: 20, comments: 10, reposts: 3, views: 200 },
    ]);

    const profile: FunnelcakeProfile = {
      pubkey: 'pk-1',
      follower_count: 500,
      following_count: 100,
    };

    const data = buildAnalyticsData(videos, bulkStats, profile);

    expect(data.kpis.totalVideos).toBe(2);
    expect(data.kpis.totalViews).toBe(300);
    expect(data.kpis.totalReactions).toBe(30);
    expect(data.followerCount).toBe(500);
    expect(data.followingCount).toBe(100);
    expect(data.topVideos).toHaveLength(2);
    expect(data.topVideos[0].title).toBe('Second'); // Higher engagement
    expect(data.fetchedAt).toBeInstanceOf(Date);
  });

  it('handles null profile gracefully', () => {
    const data = buildAnalyticsData([], makeBulkStats([]), null);

    expect(data.followerCount).toBe(0);
    expect(data.followingCount).toBe(0);
    expect(data.kpis.totalVideos).toBe(0);
  });
});
