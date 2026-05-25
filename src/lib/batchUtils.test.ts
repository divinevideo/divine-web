// ABOUTME: Tests for batch utility functions
// ABOUTME: Tests deduplication and chunking operations

import { describe, it, expect } from 'vitest';
import { dedupeArray, chunkArray } from './batchUtils';

describe('dedupeArray', () => {
  it('removes duplicates preserving order', () => {
    expect(dedupeArray(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('handles empty array', () => {
    expect(dedupeArray([])).toEqual([]);
  });

  it('handles array with all unique values', () => {
    expect(dedupeArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('handles array with all same values', () => {
    expect(dedupeArray(['x', 'x', 'x'])).toEqual(['x']);
  });
});

describe('chunkArray', () => {
  it('splits array into chunks of specified size', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('handles array smaller than chunk size', () => {
    expect(chunkArray([1, 2], 5)).toEqual([[1, 2]]);
  });

  it('handles empty array', () => {
    expect(chunkArray([], 3)).toEqual([]);
  });

  it('handles exact multiple of chunk size', () => {
    expect(chunkArray([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  it('throws on invalid chunk size', () => {
    expect(() => chunkArray([1, 2], 0)).toThrow('Chunk size must be positive');
    expect(() => chunkArray([1, 2], -1)).toThrow('Chunk size must be positive');
  });
});
