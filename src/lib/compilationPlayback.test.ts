import { describe, expect, it } from 'vitest';
import {
  buildCompilationPlaybackUrl,
  getCompilationFallbackPath,
  getCompilationTitle,
  getSafeCompilationPath,
  parseCompilationPlaybackParams,
} from '@/lib/compilationPlayback';

describe('compilationPlayback', () => {
  it('builds and parses search descriptors with return state', () => {
    const url = buildCompilationPlaybackUrl({
      source: 'search',
      query: 'twerking',
      filter: 'videos',
      sort: 'relevance',
      start: 0,
      returnTo: '/search?q=twerking&filter=videos',
    });

    expect(url).toContain('/watch?');
    expect(
      parseCompilationPlaybackParams(new URL(url, 'https://divine.video').searchParams)
    ).toMatchObject({
      play: 'compilation',
      source: 'search',
      query: 'twerking',
      filter: 'videos',
      sort: 'relevance',
      start: 0,
      returnTo: '/search?q=twerking&filter=videos',
    });
  });

  it('derives deterministic fallback routes when returnTo is absent', () => {
    expect(getCompilationFallbackPath({ source: 'classics' })).toBe('/discovery/classics');
    expect(getCompilationFallbackPath({ source: 'hashtag', tag: 'dance' })).toBe('/hashtag/dance');
  });

  it('preserves explicit feed surface context for shared compilation urls', () => {
    const url = buildCompilationPlaybackUrl({
      source: 'trending',
      sort: 'hot',
      surface: '/discovery/hot',
      start: 0,
    });
    const descriptor = parseCompilationPlaybackParams(new URL(url, 'https://divine.video').searchParams);

    expect(descriptor).toMatchObject({
      source: 'trending',
      sort: 'hot',
      surface: '/discovery/hot',
    });
    expect(getCompilationFallbackPath(descriptor)).toBe('/discovery/hot');
    expect(getCompilationTitle(descriptor)).toBe('Hot');
  });

  it('ignores invalid navigation targets from shared url params', () => {
    expect(getSafeCompilationPath('/discovery/hot?foo=1')).toBe('/discovery/hot?foo=1');
    expect(getSafeCompilationPath('//evil.example/path')).toBeUndefined();
    expect(getSafeCompilationPath('https://evil.example/path')).toBeUndefined();
    expect(getCompilationFallbackPath({
      source: 'trending',
      sort: 'hot',
      surface: '//evil.example/path',
    })).toBe('/trending');
  });
});
