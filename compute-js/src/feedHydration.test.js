import { describe, expect, it } from 'vitest';
import { compactVideoForHydration } from './feedHydration.js';

describe('compactVideoForHydration', () => {
  it('preserves Vine metadata needed by transformFunnelcakeVideo', () => {
    const compact = compactVideoForHydration({
      id: 'abc123',
      pubkey: 'def456',
      kind: 34236,
      d_tag: 'vine-1',
      title: 'Classic vine',
      content: 'looped 100 times',
      thumbnail: 'https://example.com/thumb.jpg',
      video_url: 'https://example.com/video.mp4',
      created_at: 1700000000,
      loops: 100,
      platform: 'vine',
      classic: true,
      tags: [['platform', 'vine'], ['loops', '100']],
    });

    expect(compact.platform).toBe('vine');
    expect(compact.classic).toBe(true);
    expect(compact.tags).toEqual([['platform', 'vine'], ['loops', '100']]);
  });

  it('keeps core display and stats fields', () => {
    const compact = compactVideoForHydration({
      id: 'abc123',
      pubkey: 'def456',
      kind: 34236,
      d_tag: 'vid-1',
      title: 'Title',
      content: 'Body',
      thumbnail: 'https://example.com/thumb.jpg',
      video_url: 'https://example.com/video.mp4',
      created_at: 1700000000,
      reactions: 5,
      comments: 2,
      reposts: 1,
      loops: 9,
      views: 42,
      engagement_score: 3.5,
      author_name: 'Alice',
      author_avatar: 'https://example.com/avatar.jpg',
    });

    expect(compact).toMatchObject({
      id: 'abc123',
      pubkey: 'def456',
      kind: 34236,
      d_tag: 'vid-1',
      title: 'Title',
      content: 'Body',
      reactions: 5,
      comments: 2,
      reposts: 1,
      loops: 9,
      views: 42,
      engagement_score: 3.5,
      author_name: 'Alice',
      author_avatar: 'https://example.com/avatar.jpg',
    });
  });
});
