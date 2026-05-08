import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useVideoPrefetch } from './useVideoPrefetch';
import type { ParsedVideoData } from '@/types/video';

function makeVideo(overrides: Partial<ParsedVideoData> = {}): ParsedVideoData {
  return {
    id: 'video-1',
    pubkey: 'f'.repeat(64),
    kind: 34236,
    createdAt: 1700000000,
    content: 'Test video',
    videoUrl: 'https://media.divine.video/video-1',
    thumbnailUrl: 'https://media.divine.video/video-1.jpg',
    hashtags: [],
    vineId: 'vine-id-1',
    reposts: [],
    isVineMigrated: false,
    ...overrides,
  };
}

describe('useVideoPrefetch', () => {
  beforeEach(() => {
    document.head.querySelectorAll('link[rel="prefetch"]').forEach((link) => link.remove());
  });

  afterEach(() => {
    document.head.querySelectorAll('link[rel="prefetch"]').forEach((link) => link.remove());
  });

  it('does not prefetch age-restricted media.divine.video assets', () => {
    renderHook(() =>
      useVideoPrefetch('video-1', [
        makeVideo({ id: 'video-1' }),
        makeVideo({
          id: 'restricted-video',
          ageRestricted: true,
          videoUrl: 'https://media.divine.video/restricted-video',
          thumbnailUrl: 'https://media.divine.video/restricted-video.jpg',
        }),
      ]),
    );

    const prefetchHrefs = Array.from(document.head.querySelectorAll('link[rel="prefetch"]'))
      .map((link) => (link as HTMLLinkElement).href);

    expect(prefetchHrefs).not.toContain('https://media.divine.video/restricted-video');
    expect(prefetchHrefs).not.toContain('https://media.divine.video/restricted-video.jpg');
  });

  it('does not prefetch protected media when age-restriction status is unknown', () => {
    renderHook(() =>
      useVideoPrefetch('video-1', [
        makeVideo({ id: 'video-1' }),
        makeVideo({
          id: 'unknown-status-video',
          ageRestricted: undefined,
          videoUrl: 'https://media.divine.video/unknown-status-video',
          thumbnailUrl: 'https://media.divine.video/unknown-status-video.jpg',
        }),
      ]),
    );

    const prefetchHrefs = Array.from(document.head.querySelectorAll('link[rel="prefetch"]'))
      .map((link) => (link as HTMLLinkElement).href);

    expect(prefetchHrefs).not.toContain('https://media.divine.video/unknown-status-video');
    expect(prefetchHrefs).not.toContain('https://media.divine.video/unknown-status-video.jpg');
  });

  it('continues prefetching unrestricted upcoming media', () => {
    renderHook(() =>
      useVideoPrefetch('video-1', [
        makeVideo({ id: 'video-1' }),
        makeVideo({
          id: 'public-video',
          ageRestricted: false,
          videoUrl: 'https://media.divine.video/public-video',
          thumbnailUrl: 'https://media.divine.video/public-video.jpg',
        }),
      ]),
    );

    const prefetchHrefs = Array.from(document.head.querySelectorAll('link[rel="prefetch"]'))
      .map((link) => (link as HTMLLinkElement).href);

    expect(prefetchHrefs).toContain('https://media.divine.video/public-video');
    expect(prefetchHrefs).toContain('https://media.divine.video/public-video.jpg');
  });
});
