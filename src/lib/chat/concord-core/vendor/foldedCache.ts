/**
 * The client's IndexedDB-backed fold cache, reduced to a process-local Map.
 *
 * `rekey.ts` uses it for ONE thing: reserving a rotation key under
 * `(rotator, scope, epoch, prevCommit)` so a retried rotation re-publishes the
 * same key instead of minting a second one and splitting the community across
 * two continuity-valid halves (see `mintOrReuseRotationKey`).
 *
 * The bridge does not rotate — it holds no MANAGE authority in any community
 * it joins — so this path is unreachable today and exists to keep the vendored
 * file byte-faithful. If a bridge ever DOES rotate, this must become durable
 * storage first: a reservation that dies with the process is no reservation at
 * all across a crash-and-retry, which is exactly when it matters.
 */

const cache = new Map<string, unknown>();

export async function readFolded<T>(key: string): Promise<T | undefined> {
  return cache.get(key) as T | undefined;
}

export async function writeFolded<T>(key: string, value: T): Promise<void> {
  cache.set(key, value);
}
