import { describe, expect, it } from 'vitest';
import { formatClassicVineViewBreakdown } from './formatUtils';

describe('formatClassicVineViewBreakdown', () => {
  it('returns null when there are no archived Vine loops', () => {
    expect(formatClassicVineViewBreakdown(25, 0)).toBeNull();
  });

  it('shows only the archived Vine loop count', () => {
    expect(formatClassicVineViewBreakdown(100, 100)).toBe('100 Loops');
  });

  it('does not show new Divine views for classic Vines', () => {
    expect(formatClassicVineViewBreakdown(120, 100)).toBe('100 Loops');
  });

  it('keeps the archived loop count compact', () => {
    expect(formatClassicVineViewBreakdown(50453074, 50453008)).toBe('50.5M Loops');
  });

  it('handles singular loop labels and ignores negative new-view deltas', () => {
    expect(formatClassicVineViewBreakdown(2, 1)).toBe('1 Loop');
    expect(formatClassicVineViewBreakdown(90, 100)).toBe('100 Loops');
  });
});
