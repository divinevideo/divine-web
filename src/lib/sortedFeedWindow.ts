// ABOUTME: Raw-event pagination helpers for relay sorted feeds
// ABOUTME: Keeps NIP-50 sorted windows advancing even when parsing drops events

export const SORTED_FEED_BACKFILL_ATTEMPTS = 3;

export function nextSortedOffset(eventCount: number, offset: number): number {
  return Math.max(eventCount, offset);
}

export function sortedFeedHasMore(eventCount: number, requestedLimit: number): boolean {
  return eventCount >= requestedLimit;
}

export function sortedFeedWindowSize(pageSize: number, attempt: number): number {
  return pageSize * (attempt + 1);
}
