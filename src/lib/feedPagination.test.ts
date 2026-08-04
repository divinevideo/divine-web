// ABOUTME: Tests for infinite-feed page accounting helpers
// ABOUTME: Covers the fetched-item count that keeps infinite scroll re-arming

import { describe, it, expect } from 'vitest';
import { countFetchedVideos } from './feedPagination';

describe('countFetchedVideos', () => {
  it('returns 0 when no pages have been fetched', () => {
    expect(countFetchedVideos(undefined)).toBe(0);
    expect(countFetchedVideos([])).toBe(0);
  });

  it('sums videos across every fetched page', () => {
    expect(countFetchedVideos([
      { videos: [{ id: 'a' }, { id: 'b' }] },
      { videos: [{ id: 'c' }] },
    ])).toBe(3);
  });

  it('tolerates pages that carry no videos array', () => {
    expect(countFetchedVideos([
      { videos: [{ id: 'a' }] },
      {} as { videos: unknown[] },
    ])).toBe(1);
  });

  // divine-web#380: react-infinite-scroll-component only re-arms its internal
  // `actionTriggered` guard when `dataLength` changes. A page whose rows all
  // collapse under addressable-key dedup (or per-viewer block filtering) adds
  // nothing to the rendered list, so a deduped length would stall the feed
  // permanently even though `hasNextPage` is still true. The fetched count has
  // to keep climbing.
  it('keeps climbing when a whole page dedupes away to nothing', () => {
    const duplicateRow = { id: 'a' };
    const firstPageOnly = [{ videos: [duplicateRow, { id: 'b' }] }];
    const withCollapsingPage = [
      ...firstPageOnly,
      { videos: [duplicateRow, duplicateRow] },
    ];

    expect(countFetchedVideos(firstPageOnly)).toBe(2);
    expect(countFetchedVideos(withCollapsingPage)).toBe(4);
    expect(countFetchedVideos(withCollapsingPage))
      .toBeGreaterThan(countFetchedVideos(firstPageOnly));
  });

  // Callers must feed this the *unfiltered* query pages. Per-viewer block/mute
  // filtering runs before the page reaches the component, so counting filtered
  // pages would stall again the moment a page is entirely blocked authors.
  it('reports 0 for a page that was emptied before counting', () => {
    expect(countFetchedVideos([
      { videos: [{ id: 'a' }] },
      { videos: [] },
    ])).toBe(1);
  });
});
