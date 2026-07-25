// ABOUTME: Wraps a slide index around the ends of a list so navigation is circular
// ABOUTME: Past the last item lands on the first; before the first lands on the last

/**
 * Normalize an out-of-range index into `[0, count)`.
 *
 * Plain `index % count` is not enough: JavaScript's `%` keeps the sign of the
 * dividend, so `-1 % 5` is `-1` rather than `4`. Adding `count` before the
 * second modulo pulls negatives back into range.
 */
export function wrapIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

/** True when the index falls outside the list and therefore wrapped. */
export function isWrap(index: number, count: number): boolean {
  return count > 0 && (index < 0 || index >= count);
}
