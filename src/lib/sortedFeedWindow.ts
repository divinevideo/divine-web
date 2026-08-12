// ABOUTME: Raw-event pagination helpers for relay feed backfill
// ABOUTME: Keeps feed windows advancing even when parsing drops events

export const RAW_FEED_BACKFILL_ATTEMPTS = 3;

export function nextSortedOffset(eventCount: number, offset: number): number {
  return Math.max(eventCount, offset);
}

export function sortedFeedHasMore(eventCount: number, requestedLimit: number): boolean {
  return eventCount >= requestedLimit;
}

export function sortedFeedWindowSize(pageSize: number, attempt: number): number {
  return pageSize * (attempt + 1);
}
