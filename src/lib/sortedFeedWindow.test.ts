import { describe, expect, it } from 'vitest';

import {
  nextSortedOffset,
  sortedFeedHasMore,
  sortedFeedWindowSize,
} from '@/lib/sortedFeedWindow';

describe('sortedFeedWindow', () => {
  it('advances sorted offsets by raw events consumed', () => {
    expect(nextSortedOffset(20, 0)).toBe(20);
    expect(nextSortedOffset(40, 20)).toBe(40);
  });

  it('does not move a sorted offset backwards for short capped responses', () => {
    expect(nextSortedOffset(18, 20)).toBe(20);
  });

  it('continues while the relay fills the requested limit', () => {
    expect(sortedFeedHasMore(20, 20)).toBe(true);
    expect(sortedFeedHasMore(19, 20)).toBe(false);
  });

  it('expands the raw window by one page per backfill attempt', () => {
    expect(sortedFeedWindowSize(20, 0)).toBe(20);
    expect(sortedFeedWindowSize(20, 1)).toBe(40);
    expect(sortedFeedWindowSize(20, 2)).toBe(60);
  });
});
