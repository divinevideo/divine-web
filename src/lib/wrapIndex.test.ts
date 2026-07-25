// ABOUTME: Tests for circular slide-index navigation
// ABOUTME: Covers both ends, negative wrapping, and degenerate list sizes

import { describe, expect, it } from 'vitest';

import { isWrap, wrapIndex } from './wrapIndex';

describe('wrapIndex', () => {
  it('leaves in-range indexes alone', () => {
    expect(wrapIndex(0, 5)).toBe(0);
    expect(wrapIndex(3, 5)).toBe(3);
    expect(wrapIndex(4, 5)).toBe(4);
  });

  it('wraps forward past the last slide to the first', () => {
    expect(wrapIndex(5, 5)).toBe(0);
    expect(wrapIndex(6, 5)).toBe(1);
  });

  it('wraps backward before the first slide to the last', () => {
    // JS `%` keeps the dividend's sign, so this is the case a naive
    // `index % count` gets wrong.
    expect(wrapIndex(-1, 5)).toBe(4);
    expect(wrapIndex(-2, 5)).toBe(3);
  });

  it('handles a single slide by staying put', () => {
    expect(wrapIndex(1, 1)).toBe(0);
    expect(wrapIndex(-1, 1)).toBe(0);
  });

  it('returns 0 for an empty list rather than NaN', () => {
    expect(wrapIndex(2, 0)).toBe(0);
    expect(wrapIndex(-2, 0)).toBe(0);
  });
});

describe('isWrap', () => {
  it('flags only out-of-range indexes', () => {
    expect(isWrap(0, 5)).toBe(false);
    expect(isWrap(4, 5)).toBe(false);
    expect(isWrap(5, 5)).toBe(true);
    expect(isWrap(-1, 5)).toBe(true);
  });

  it('never flags a wrap on an empty list', () => {
    expect(isWrap(-1, 0)).toBe(false);
  });
});
