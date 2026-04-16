import { describe, expect, it } from 'vitest';
import {
  buildCompilationPlaybackUrl,
  getCompilationFallbackPath,
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
});
