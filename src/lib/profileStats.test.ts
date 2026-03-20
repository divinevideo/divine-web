import { describe, expect, it } from 'vitest';
import { buildProfileStats } from './profileStats';
import type { ParsedVideoData } from '@/types/video';

function makeVideo(overrides: Partial<ParsedVideoData> = {}): ParsedVideoData {
  return {
    id: 'video-1',
    pubkey: 'pubkey-1',
    kind: 34236,
    createdAt: 1700000000,
    content: '',
    videoUrl: 'https://example.com/video.mp4',
    hashtags: [],
    vineId: 'vine-id',
    isVineMigrated: false,
    reposts: [],
    ...overrides,
  };
}

describe('buildProfileStats', () => {
  it('prefers archive stats over currently loaded profile videos for classic totals', () => {
    const stats = buildProfileStats({
      funnelcakeProfile: {
        pubkey: 'pubkey-1',
        video_count: 398,
        follower_count: 63,
        following_count: 0,
        total_loops: 2256,
        total_views: 2578,
        total_reactions: 59696,
      },
      loadedVideos: [
        makeVideo({
          isVineMigrated: true,
          loopCount: 100,
        }),
      ],
      archiveStats: {
        classicVineCount: 398,
        originalLoopCount: 2300000000,
      },
      joinedDate: null,
      joinedDateLoading: false,
      hasNextPage: true,
    });

    expect(stats.classicVineCount).toBe(398);
    expect(stats.originalLoopCount).toBe(2300000000);
    expect(stats.totalLoops).toBe(2256);
  });
});
