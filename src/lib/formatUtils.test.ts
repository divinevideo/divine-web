import { describe, expect, it } from 'vitest';
import { formatClassicVineViewBreakdown } from './formatUtils';

describe('formatClassicVineViewBreakdown', () => {
  it('returns null when there are no archived Vine loops', () => {
    expect(formatClassicVineViewBreakdown(25, 0)).toBeNull();
  });

  it('shows only Vine loops when there are no new diVine views yet', () => {
    expect(formatClassicVineViewBreakdown(100, 100)).toBe('100 Vine loops');
  });

  it('shows archived and new views when classic Vines receive fresh traffic', () => {
    expect(formatClassicVineViewBreakdown(120, 100)).toBe('100 Vine loops + 20 new views');
  });

  it('uses exact loop counts when compact rounding would make the breakdown look duplicated', () => {
    expect(formatClassicVineViewBreakdown(50453074, 50453008)).toBe('50,453,008 Vine loops + 66 new views');
  });

  it('handles singular new view labels and guards against negative deltas', () => {
    expect(formatClassicVineViewBreakdown(101, 100)).toBe('100 Vine loops + 1 new view');
    expect(formatClassicVineViewBreakdown(90, 100)).toBe('100 Vine loops');
  });
});
