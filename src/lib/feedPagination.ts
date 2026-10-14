// ABOUTME: Page accounting helpers for infinite video feeds
// ABOUTME: Counts fetched rows so infinite scroll re-arms on every loaded page

interface CountablePage {
  /** Rows the API returned, before any were dropped. Preferred when present. */
  fetchedRows?: number;
  videos?: readonly unknown[];
}

/**
 * Total rows fetched across every loaded page.
 *
 * `react-infinite-scroll-component` re-arms its internal trigger only when
 * `dataLength` changes, so feeds must report a count that grows with each
 * fetched page rather than the length of the rendered list. Rendered lists are
 * deduplicated by addressable key and filtered per viewer, either of which can
 * collapse a whole page to nothing and stall the feed permanently.
 *
 * Pass the unfiltered query pages: block/mute filtering happens downstream, and
 * counting already-filtered pages reintroduces the stall.
 *
 * `fetchedRows` is preferred over `videos.length` because a page's `videos` has
 * already lost the rows that duplicated within that page and any the transform
 * had to drop. Keying pagination on what survived that is the same mistake as
 * keying it on the rendered list, one layer down; the count the API returned
 * cannot collapse. Pages without it (the websocket path) fall back to the
 * parsed length.
 */
export function countFetchedVideos(pages: readonly CountablePage[] | undefined): number {
  return (
    pages?.reduce(
      (total, page) => total + (page.fetchedRows ?? page.videos?.length ?? 0),
      0
    ) ?? 0
  );
}
