import { describe, expect, it } from 'vitest';

import { clampProductAnalyticsInteger } from './productAnalyticsBounds';

describe('clampProductAnalyticsInteger', () => {
  it.each([
    [-1, 0, 10_000, 0],
    [10_001, 0, 10_000, 10_000],
    [499, 500, 3_600_000, 500],
    [3_600_001, 500, 3_600_000, 3_600_000],
    [86_400_001, 0, 86_400_000, 86_400_000],
    [1_001, 0, 1_000, 1_000],
  ])('clamps %i to the contract range', (value, minimum, maximum, expected) => {
    expect(clampProductAnalyticsInteger(value, minimum, maximum)).toBe(expected);
  });
});
