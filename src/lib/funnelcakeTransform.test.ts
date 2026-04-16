import { describe, expect, it } from 'vitest';
import { transformFunnelcakeVideo, transformToVideoPage } from './funnelcakeTransform';
import type { FunnelcakeVideoRaw, FunnelcakeResponse } from '@/types/funnelcake';

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

  it('prefers archived Vine loop tags over current Divine loop fields', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      platform: 'vine',
      loops: 28,
      content: 'Original stats: 296,752 loops - 5,753 likes',
      tags: [
        ['platform', 'vine'],
        ['loops', '296752'],
        ['d', '592tnaPXh6z'],
      ],
    }));

    expect(video.loopCount).toBe(296752);
  });

  it('preserves the age-restricted flag from the API payload', () => {
    const video = transformFunnelcakeVideo(makeRawVideo({
      age_restricted: true,
    }));

    expect(video.ageRestricted).toBe(true);
  });
});

function makeResponse(overrides: Partial<FunnelcakeResponse> = {}): FunnelcakeResponse {
  return {
    videos: [makeRawVideo()],
    has_more: true,
    next_cursor: 'abc123',
    ...overrides,
  };
}

describe('transformToVideoPage', () => {
  describe('cursor type (recommendations)', () => {
    it('returns raw cursor string when cursorType is cursor', () => {
      const page = transformToVideoPage(makeResponse({ next_cursor: 'opaque-cursor-xyz' }), 'cursor');
      expect(page.rawCursor).toBe('opaque-cursor-xyz');
      expect(page.nextCursor).toBeUndefined();
      expect(page.offset).toBeUndefined();
    });

    it('returns no rawCursor when has_more is false', () => {
      const page = transformToVideoPage(makeResponse({ has_more: false, next_cursor: 'opaque-cursor-xyz' }), 'cursor');
      expect(page.rawCursor).toBeUndefined();
      expect(page.hasMore).toBe(false);
    });

    it('returns no rawCursor when next_cursor is null/undefined', () => {
      const page = transformToVideoPage(makeResponse({ has_more: true, next_cursor: undefined }), 'cursor');
      expect(page.rawCursor).toBeUndefined();
    });
  });

  describe('offset type', () => {
    it('parses next_cursor as integer offset', () => {
      const page = transformToVideoPage(makeResponse({ next_cursor: '24' }), 'offset');
      expect(page.offset).toBe(24);
      expect(page.rawCursor).toBeUndefined();
    });
  });

  describe('timestamp type (default)', () => {
    it('parses next_cursor as numeric timestamp', () => {
      const page = transformToVideoPage(makeResponse({ next_cursor: '1700000000' }), 'timestamp');
      expect(page.nextCursor).toBe(1700000000);
      expect(page.rawCursor).toBeUndefined();
      expect(page.offset).toBeUndefined();
    });
  });

  it('stops pagination when has_more is false', () => {
    const page = transformToVideoPage(makeResponse({ has_more: false }));
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeUndefined();
    expect(page.offset).toBeUndefined();
    expect(page.rawCursor).toBeUndefined();
  });
});
