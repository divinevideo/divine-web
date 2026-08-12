// ABOUTME: Raw-event pagination helpers for relay feed backfill
// ABOUTME: Keeps feed windows advancing even when parsing drops events

// When a raw window parses zero videos we expand and retry, but only this many
// times. This bound doubles as the feed's reachability ceiling: after roughly
// RAW_FEED_BACKFILL_ATTEMPTS * pageSize consecutive unparseable events,
// pagination stops even if valid videos exist deeper. The cap is deliberate:
// it prevents an unbounded relay-hammering loop on a bad data cluster.
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
