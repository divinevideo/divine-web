import { describe, expect, it } from 'vitest';
import { compactVideoForHydration, normalizeFeedResponse } from './feedHydration.js';

describe('normalizeFeedResponse', () => {
  it('maps a v2 envelope to the client videos shape', () => {
    const result = normalizeFeedResponse({
      data: [{ id: 'a' }, { id: 'b' }],
      pagination: { next_cursor: 'o:10', has_more: true },
    });
    expect(result).toEqual({
      videos: [{ id: 'a' }, { id: 'b' }],
      next_cursor: 'o:10',
      has_more: true,
    });
  });

  it('defaults missing pagination fields', () => {
    const result = normalizeFeedResponse({ data: [] });
    expect(result).toEqual({ videos: [], next_cursor: undefined, has_more: false });
  });

  it('passes legacy v1 arrays through untouched', () => {
    const arr = [{ id: 'a' }];
    expect(normalizeFeedResponse(arr)).toBe(arr);
  });

  it('passes null and already-shaped payloads through untouched', () => {
    expect(normalizeFeedResponse(null)).toBeNull();
    const shaped = { videos: [{ id: 'a' }] };
    expect(normalizeFeedResponse(shaped)).toBe(shaped);
  });
});

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
