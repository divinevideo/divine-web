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
  const setUserAgent = (userAgent: string) => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: userAgent,
    });
  };

  beforeEach(() => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36');
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

  it('skips video prefetches in Firefox but keeps image prefetches', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0');

    renderHook(() =>
      useVideoPrefetch('video-1', [
        makeVideo({ id: 'video-1' }),
        makeVideo({
          id: 'firefox-video',
          ageRestricted: false,
          videoUrl: 'https://media.divine.video/firefox-video',
          thumbnailUrl: 'https://media.divine.video/firefox-video.jpg',
        }),
      ]),
    );

    const prefetchLinks = Array.from(document.head.querySelectorAll('link[rel="prefetch"]')) as HTMLLinkElement[];
    const prefetchHrefs = prefetchLinks.map((link) => link.href);
    const videoPrefetches = prefetchLinks.filter((link) => link.as === 'video');

    expect(videoPrefetches).toHaveLength(0);
    expect(prefetchHrefs).not.toContain('https://media.divine.video/firefox-video');
    expect(prefetchHrefs).toContain('https://media.divine.video/firefox-video.jpg');
  });
});
