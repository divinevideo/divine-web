// ABOUTME: Pure Fisher-Yates shuffle, returning a new array
// ABOUTME: Takes an optional RNG so the shuffle is deterministic in tests

/**
 * Return a shuffled copy of `items` using an unbiased Fisher-Yates shuffle.
 *
 * The input is never mutated. `rng` defaults to `Math.random`; inject a
 * deterministic generator in tests to assert a specific ordering.
 */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
