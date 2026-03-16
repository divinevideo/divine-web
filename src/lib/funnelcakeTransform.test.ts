import { describe, expect, it } from 'vitest';
import { mergeVideoStats, transformFunnelcakeVideo } from './funnelcakeTransform';
import type { FunnelcakeVideoRaw } from '@/types/funnelcake';

function makeRawVideo(overrides: Partial<FunnelcakeVideoRaw> = {}): FunnelcakeVideoRaw {
  return {
    id: 'video-1',
    pubkey: 'pubkey-1',
    created_at: 1700000000,
    kind: 34236,
    d_tag: 'vine-id',
    title: 'Test title',
    content: 'Test content',
    video_url: 'https://media.divine.video/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.mp4',
    ...overrides,
  };
}

describe('transformFunnelcakeVideo', () => {
  it('treats direct lookup videos with a platform tag as archived Vine imports', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      tags: [
        ['platform', 'vine'],
        ['d', 'vine-id'],
      ],
    }));

    expect(video.isVineMigrated).toBe(true);
    expect(video.origin).toEqual({
      platform: 'vine',
      externalId: 'vine-id',
    });
  });

  it('prefers the larger archived loop count for classic videos when raw loops are smaller', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      platform: 'vine',
      loops: 1,
      views: 2,
      content: 'Original stats: 14,890,612 loops - 59,540 likes',
    }));

    expect(video.loopCount).toBe(14890612);
    expect(video.divineViewCount).toBe(2);
  });

  it('keeps the API loop count when it is already the largest classic value', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      platform: 'vine',
      loops: 2965624,
      content: 'Original stats: 2,100,000 loops - 500 likes',
    }));

    expect(video.loopCount).toBe(2965624);
  });

  it('does not treat free-text loop counts as archived stats for non-classic videos', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      platform: 'tiktok',
      loops: 12,
      content: 'Original stats: 999,999 loops',
    }));

    expect(video.isVineMigrated).toBe(false);
    expect(video.loopCount).toBe(12);
  });

  it('does not let later stats overwrite a classic archived loop count with a smaller value', () => {
    const classicVideo = transformFunnelcakeVideo(makeRawVideo({
      platform: 'vine',
      loops: 1,
      content: 'Original stats: 791,451 loops - 1,021 likes',
    }));

    const merged = mergeVideoStats(classicVideo, { loops: 2 });

    expect(merged.loopCount).toBe(791451);
  });
});
