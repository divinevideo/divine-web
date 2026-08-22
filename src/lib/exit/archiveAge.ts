// ABOUTME: Derives honest original dates from portable NIP-71 archive events
// ABOUTME: Keeps video-specific publication metadata out of unrelated event kinds

import type { NostrEvent } from "@nostrify/nostrify";

const VIDEO_KINDS = new Set([21, 22, 34235, 34236]);

export function archivedVideoDate(event: NostrEvent): number | null {
  if (!VIDEO_KINDS.has(event.kind)) return null;
  const publishedAt = event.tags.find((tag) => tag[0] === "published_at")?.[1];
  if (publishedAt && /^\d+$/.test(publishedAt)) {
    const parsed = Number(publishedAt);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return event.created_at;
}

export function oldestArchivedVideoDate(events: NostrEvent[]): number | null {
  let oldest: number | null = null;
  for (const event of events) {
    const timestamp = archivedVideoDate(event);
    if (timestamp !== null && (oldest === null || timestamp < oldest)) oldest = timestamp;
  }
  return oldest;
}
