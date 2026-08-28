// ABOUTME: Walks cursor-paginated export endpoints while preserving successfully retrieved pages
// ABOUTME: Handles bounded rate-limit retries, stalled cursors, cancellation, and page limits

import type { NostrEvent } from "@nostrify/nostrify";

import type { ExportPage } from "./exportTransport";

export interface CursorFailure extends Error {
  code: string;
  retryAfterMs?: number;
}

export interface CursorWalkProgress {
  pagesFetched: number;
  eventsFetched: number;
  retryCount: number;
}

export async function walkExportCursor<TFailure extends CursorFailure>(input: {
  fetchPage: (cursor: string | undefined, rateLimitRetryCount: number) => Promise<ExportPage>;
  isFailure: (error: unknown) => error is TFailure;
  makeFailure: (code: "network-failure" | "malformed-response" | "stalled-cursor" | "page-limit", detail?: number) => TFailure;
  makeCancelledFailure: () => TFailure;
  cancelledCode: string;
  rateLimitedCode: string;
  sleep?: (ms: number) => Promise<void>;
  signal?: AbortSignal;
  maxRateLimitRetries?: number;
  maxPages?: number;
  onProgress?: (progress: CursorWalkProgress) => void;
}): Promise<{ events: NostrEvent[]; pageCount: number; failures: TFailure[] }> {
  const events: NostrEvent[] = [];
  const failures: TFailure[] = [];
  const usedCursors = new Set<string>();
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const maxRateLimitRetries = input.maxRateLimitRetries ?? 3;
  // This is a protocol backstop, not an account-size limit. At the default
  // page size it permits five million events before preserving a partial walk.
  const maxPages = input.maxPages ?? 10_000;
  let cursor: string | undefined;
  let pagesFetched = 0;
  let retryCount = 0;
  let pageRetries = 0;

  for (;;) {
    try {
      const page = await input.fetchPage(cursor, pageRetries);
      pagesFetched += 1;
      events.push(...page.data);
      pageRetries = 0;
      input.onProgress?.({ pagesFetched, eventsFetched: events.length, retryCount });
      if (!page.pagination.has_more) return { events, pageCount: pagesFetched, failures };
      if (!page.pagination.next_cursor) throw input.makeFailure("malformed-response");
      if (usedCursors.has(page.pagination.next_cursor)) {
        failures.push(input.makeFailure("stalled-cursor"));
        return { events, pageCount: pagesFetched, failures };
      }
      if (pagesFetched >= maxPages) {
        failures.push(input.makeFailure("page-limit", maxPages));
        return { events, pageCount: pagesFetched, failures };
      }
      usedCursors.add(page.pagination.next_cursor);
      cursor = page.pagination.next_cursor;
    } catch (error) {
      if (input.isFailure(error) && (error.code === input.rateLimitedCode || error.retryAfterMs !== undefined) && pageRetries < maxRateLimitRetries) {
        pageRetries += 1;
        retryCount += 1;
        input.onProgress?.({ pagesFetched, eventsFetched: events.length, retryCount });
        await waitForRetry(error.retryAfterMs ?? 1000, sleep, input.signal, input.makeCancelledFailure);
        continue;
      }
      if (input.isFailure(error) && error.code === input.cancelledCode) throw error;
      const failure = input.isFailure(error) ? error : input.makeFailure("network-failure");
      failures.push(failure);
      // A completed page is still useful. Keep it and report why the walk
      // stopped instead of discarding data already recovered.
      if (events.length > 0) return { events, pageCount: pagesFetched, failures };
      throw failure;
    }
  }
}

async function waitForRetry(ms: number, sleep: (ms: number) => Promise<void>, signal: AbortSignal | undefined, aborted: () => Error) {
  if (!signal) return sleep(ms);
  if (signal.aborted) throw aborted();
  let onAbort: () => void = () => undefined;
  const cancellation = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(aborted());
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    await Promise.race([sleep(ms), cancellation]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
