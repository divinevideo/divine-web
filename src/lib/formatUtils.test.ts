import { describe, expect, it } from 'vitest';
import { formatClassicVineViewBreakdown } from './formatUtils';

describe('formatClassicVineViewBreakdown', () => {
  it('returns null when there are no archived Vine loops', () => {
    expect(formatClassicVineViewBreakdown(25, 0)).toBeNull();
  });

  it('shows only Vine loops when there are no new diVine views yet', () => {
    expect(formatClassicVineViewBreakdown(100, 100)).toBe('100 Classic Loops');
  });

  it('shows archived and new views when classic Vines receive fresh traffic', () => {
    expect(formatClassicVineViewBreakdown(120, 100)).toBe('100 Classic Loops - 20 New');
  });

  it('keeps the classic loop count compact and the new delta precise', () => {
    expect(formatClassicVineViewBreakdown(50453074, 50453008)).toBe('50.5M Classic Loops - 66 New');
  });

  it('handles singular new view labels and guards against negative deltas', () => {
    expect(formatClassicVineViewBreakdown(101, 100)).toBe('100 Classic Loops - 1 New');
    expect(formatClassicVineViewBreakdown(90, 100)).toBe('100 Classic Loops');
  });
});
