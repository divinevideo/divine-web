import { describe, expect, it } from 'vitest';
import {
  buildCompilationPlaybackUrl,
  clearCompilationPlaybackParams,
  getCompilationStartIndex,
  parseCompilationPlaybackParams,
} from '@/lib/compilationPlayback';

describe('compilationPlayback', () => {
  it('builds same-page compilation urls without leaving the source route', () => {
    expect(
      buildCompilationPlaybackUrl('/discovery/classics', { start: 0 })
    ).toBe('/discovery/classics?play=compilation&start=0');

    expect(
      buildCompilationPlaybackUrl('/search?q=twerking&filter=videos', { start: 0 })
    ).toBe('/search?q=twerking&filter=videos&play=compilation&start=0');
  });

  it('parses compilation params from source-page urls', () => {
    const descriptor = parseCompilationPlaybackParams(
      new URLSearchParams('q=twerking&play=compilation&video=video-7')
    );

    expect(descriptor).toEqual({
      play: true,
      start: undefined,
      videoId: 'video-7',
    });
  });

  it('clears compilation params while preserving the source page query state', () => {
    const params = new URLSearchParams('q=twerking&filter=videos&play=compilation&start=0&video=video-2');

    clearCompilationPlaybackParams(params);

    expect(params.toString()).toBe('q=twerking&filter=videos');
  });

  it('resolves requested start positions against loaded videos', () => {
    const videos = [{ id: 'video-1' }, { id: 'video-2' }];

    expect(getCompilationStartIndex({ play: true, start: 1 }, videos)).toBe(1);
    expect(getCompilationStartIndex({ play: true, videoId: 'video-2' }, videos)).toBe(1);
    expect(getCompilationStartIndex({ play: true, videoId: 'missing' }, videos)).toBe(-1);
  });
});
