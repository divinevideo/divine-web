/**
 * Insertion-order caps for the decode-once memos.
 *
 * The memos were written for the Armada client, where a session is a browser
 * tab and "never evict" is harmless. The bridge is one process that runs for
 * weeks and decodes every message it mirrors, its own echoes included: the
 * chat memo alone held ~2.4KB per message, forever, and grew with every
 * history import (2026-09-23 OOM). A memo is only ever a cache — a miss just
 * decodes again — so evicting the oldest entry changes cost, never results.
 */

/** Default ceiling per memo: far above any one screen's working set. */
export const MEMO_CAP = 20_000;

/** `map.set`, first evicting the oldest entries once `cap` is reached. */
export function memoSet<K, V>(
  map: Map<K, V>,
  key: K,
  value: V,
  cap = MEMO_CAP,
  onEvict?: (key: K) => void,
): void {
  if (!map.has(key)) {
    while (map.size >= cap) {
      const oldest = map.keys().next().value as K;
      map.delete(oldest);
      onEvict?.(oldest);
    }
  }
  map.set(key, value);
}
