// ABOUTME: Tests for shareUtils — verifies URL generation for videos and lists
// ABOUTME: Ensures stable d-tag IDs are preferred and apex domain URLs are always used

import { describe, it, expect, vi } from 'vitest';
import type { ParsedVideoData } from '@/types/video';

// Mock subdomainLinks before importing shareUtils
vi.mock('@/lib/subdomainLinks', () => ({
  getApexShareUrl: (path: string) => `https://divine.video${path}`,
}));

import { getVideoShareUrl, getVideoShareData, getListShareUrl, getListShareData } from './shareUtils';

function makeVideo(overrides: Partial<ParsedVideoData> = {}): ParsedVideoData {
  return {
    id: 'event-id-abc123',
    pubkey: 'pubkey-hex-abc',
    kind: 34236,
    createdAt: 1700000000,
    content: 'Test video',
    videoUrl: 'https://media.divine.video/abc/file.mp4',
    hashtags: [],
    vineId: 'stable-d-tag-id',
    isVineMigrated: false,
    reposts: [],
    ...overrides,
  };
}

describe('getVideoShareUrl', () => {
  it('prefers vineId (d-tag) over event ID for stable URLs', () => {
    const video = makeVideo({ vineId: 'my-vine-id', id: 'event-id' });
    expect(getVideoShareUrl(video)).toBe('https://divine.video/video/my-vine-id');
  });

  it('falls back to event ID when vineId is null', () => {
    const video = makeVideo({ vineId: null, id: 'event-id-fallback' });
    expect(getVideoShareUrl(video)).toBe('https://divine.video/video/event-id-fallback');
  });

  it('uses apex domain URL via getApexShareUrl', () => {
    const video = makeVideo({ vineId: 'test-id' });
    const url = getVideoShareUrl(video);
    expect(url).toMatch(/^https:\/\/divine\.video\//);
  });
});

describe('getVideoShareData', () => {
  it('returns only URL (no title/text) per owner decision', () => {
    const video = makeVideo({ vineId: 'share-test', title: 'My Cool Video' });
    const data = getVideoShareData(video);
    expect(data).toEqual({
      url: 'https://divine.video/video/share-test',
    });
    expect(data).not.toHaveProperty('title');
    expect(data).not.toHaveProperty('text');
  });
});

describe('getListShareUrl', () => {
  it('builds correct list URL with pubkey and listId', () => {
    const url = getListShareUrl('pubkey-abc', 'my-list');
    expect(url).toBe('https://divine.video/list/pubkey-abc/my-list');
  });
});

describe('getListShareData', () => {
  it('returns only URL (no title/text)', () => {
    const data = getListShareData('pubkey-abc', 'my-list');
    expect(data).toEqual({
      url: 'https://divine.video/list/pubkey-abc/my-list',
    });
    expect(data).not.toHaveProperty('title');
    expect(data).not.toHaveProperty('text');
  });
});
