// ABOUTME: Tests for the pure Fisher-Yates shuffle
// ABOUTME: Determinism via injected RNG; non-mutation; permutation invariants

import { describe, it, expect } from 'vitest';
import { shuffle } from './shuffle';

describe('shuffle', () => {
  it('does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffle(input);
    expect(input).toEqual(copy);
  });

  it('returns a permutation — same elements, same length', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input);
    expect(out).toHaveLength(input.length);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it('is deterministic given a fixed RNG', () => {
    const input = ['a', 'b', 'c', 'd'];
    // A constant RNG makes every Fisher-Yates swap pick index 0.
    const out = shuffle(input, () => 0);
    expect(out).toEqual(['b', 'c', 'd', 'a']);
    // Same RNG → same result.
    expect(shuffle(input, () => 0)).toEqual(out);
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([42])).toEqual([42]);
  });
});
