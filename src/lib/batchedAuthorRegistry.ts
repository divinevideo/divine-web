// ABOUTME: Coordinates in-flight bulk author fetches with individual useAuthor hooks
// ABOUTME: Prevents N+1 GET /api/users/{pubkey} requests while POST /api/users/bulk is already running

import type { NostrEvent, NostrMetadata } from '@nostrify/nostrify';

export interface BatchedAuthorEntry {
  event?: NostrEvent;
  metadata?: NostrMetadata;
}

interface PendingBatchSlot {
  promise: Promise<BatchedAuthorEntry | undefined>;
  resolve: (entry: BatchedAuthorEntry | undefined) => void;
  attached: boolean;
  settled: boolean;
  safetyTimer: ReturnType<typeof setTimeout> | null;
}

// Safety fallback in case a parent registers a pending batch during render
// (e.g. StrictMode double-render or abandoned transition) and never executes queryFn.
const PENDING_ATTACH_TIMEOUT_MS = 200;

const inFlightAuthorBatches = new Map<string, PendingBatchSlot>();

function settleSlot(pubkey: string, slot: PendingBatchSlot, value: BatchedAuthorEntry | undefined) {
  if (slot.settled) return;
  slot.settled = true;
  if (slot.safetyTimer !== null) {
    clearTimeout(slot.safetyTimer);
    slot.safetyTimer = null;
  }
  slot.resolve(value);
  if (inFlightAuthorBatches.get(pubkey) === slot) {
    inFlightAuthorBatches.delete(pubkey);
  }
}

/**
 * Reserve in-flight slots synchronously during parent render (before child
 * VideoCards subscribe to React Query) so child useAuthor hooks wait for the
 * parent's POST /api/users/bulk instead of firing duplicate GET /api/users/{pubkey}.
 */
export function prepareInFlightAuthorBatch(pubkeys: string[]): void {
  for (const pubkey of pubkeys) {
    if (!pubkey || inFlightAuthorBatches.has(pubkey)) continue;

    let resolveFn!: (entry: BatchedAuthorEntry | undefined) => void;
    const promise = new Promise<BatchedAuthorEntry | undefined>((resolve) => {
      resolveFn = resolve;
    });

    const slot: PendingBatchSlot = {
      promise,
      resolve: resolveFn,
      attached: false,
      settled: false,
      safetyTimer: null,
    };

    slot.safetyTimer = setTimeout(() => {
      if (!slot.attached) {
        settleSlot(pubkey, slot, undefined);
      }
    }, PENDING_ATTACH_TIMEOUT_MS);

    inFlightAuthorBatches.set(pubkey, slot);
  }
}

/**
 * Attach a real bulk fetch promise to any prepared or new slots for `pubkeys`.
 */
export function registerInFlightAuthorBatch(
  pubkeys: string[],
  batchPromise: Promise<Record<string, BatchedAuthorEntry>>,
): void {
  const targetSlots: Array<{ pubkey: string; slot: PendingBatchSlot }> = [];

  for (const pubkey of pubkeys) {
    if (!pubkey) continue;
    const existing = inFlightAuthorBatches.get(pubkey);
    if (existing) {
      if (existing.attached) continue;
      existing.attached = true;
      if (existing.safetyTimer !== null) {
        clearTimeout(existing.safetyTimer);
        existing.safetyTimer = null;
      }
      targetSlots.push({ pubkey, slot: existing });
    } else {
      let resolveFn!: (entry: BatchedAuthorEntry | undefined) => void;
      const promise = new Promise<BatchedAuthorEntry | undefined>((resolve) => {
        resolveFn = resolve;
      });
      const slot: PendingBatchSlot = {
        promise,
        resolve: resolveFn,
        attached: true,
        settled: false,
        safetyTimer: null,
      };
      inFlightAuthorBatches.set(pubkey, slot);
      targetSlots.push({ pubkey, slot });
    }
  }

  if (targetSlots.length === 0) return;

  batchPromise.then(
    (map) => {
      for (const { pubkey, slot } of targetSlots) {
        settleSlot(pubkey, slot, map[pubkey]);
      }
    },
    () => {
      for (const { pubkey, slot } of targetSlots) {
        settleSlot(pubkey, slot, undefined);
      }
    },
  );
}

/**
 * Release unattached pending slots (e.g. when a parent unmounts before its
 * bulk query starts).
 */
export function cancelPendingAuthorBatch(pubkeys: string[]): void {
  for (const pubkey of pubkeys) {
    const slot = inFlightAuthorBatches.get(pubkey);
    if (slot && !slot.attached) {
      settleSlot(pubkey, slot, undefined);
    }
  }
}

/**
 * Return the in-flight bulk author promise for a pubkey, if one is active.
 */
export function getInFlightBatchedAuthor(
  pubkey: string,
): Promise<BatchedAuthorEntry | undefined> | undefined {
  return inFlightAuthorBatches.get(pubkey)?.promise;
}
