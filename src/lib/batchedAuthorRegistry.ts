// ABOUTME: Coordinates in-flight bulk author fetches with individual useAuthor hooks
// ABOUTME: Prevents N+1 GET /api/users/{pubkey} requests while POST /api/users/bulk is already running

import type { NostrEvent, NostrMetadata } from '@nostrify/nostrify';

export interface BatchedAuthorEntry {
  event?: NostrEvent;
  metadata?: NostrMetadata;
}

const inFlightAuthorBatches = new Map<string, Promise<BatchedAuthorEntry | undefined>>();

/**
 * Register a bulk fetch promise for a set of pubkeys so individual useAuthor
 * callers mounted in the same render await the shared bulk request instead of
 * firing duplicate per-pubkey HTTP requests.
 */
export function registerInFlightAuthorBatch(
  pubkeys: string[],
  batchPromise: Promise<Record<string, BatchedAuthorEntry>>,
): void {
  for (const pubkey of pubkeys) {
    if (!pubkey || inFlightAuthorBatches.has(pubkey)) continue;

    const entryPromise = batchPromise
      .then((map) => map[pubkey])
      .catch(() => undefined);

    inFlightAuthorBatches.set(pubkey, entryPromise);
    void entryPromise.finally(() => {
      if (inFlightAuthorBatches.get(pubkey) === entryPromise) {
        inFlightAuthorBatches.delete(pubkey);
      }
    });
  }
}

/**
 * Return the in-flight bulk author promise for a pubkey, if one is active.
 */
export function getInFlightBatchedAuthor(
  pubkey: string,
): Promise<BatchedAuthorEntry | undefined> | undefined {
  return inFlightAuthorBatches.get(pubkey);
}
