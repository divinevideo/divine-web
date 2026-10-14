// ABOUTME: Finds the oldest video event timestamp used by relay age policy
// ABOUTME: Keeps account-exit disclosure aligned with publication decisions

import type { NostrEvent } from "@nostrify/nostrify";

import { EXIT_VIDEO_KINDS } from "./videoKinds";

export function archivedVideoCreatedAt(event: NostrEvent): number | null {
  return EXIT_VIDEO_KINDS.has(event.kind) ? event.created_at : null;
}

export function oldestArchivedVideoCreatedAt(events: NostrEvent[]): number | null {
  let oldest: number | null = null;
  for (const event of events) {
    const timestamp = archivedVideoCreatedAt(event);
    if (timestamp !== null && (oldest === null || timestamp < oldest)) oldest = timestamp;
  }
  return oldest;
}
