// ABOUTME: Walks cursor-paginated export endpoints while preserving successfully retrieved pages
// ABOUTME: Handles bounded rate-limit retries, stalled cursors, cancellation, and page limits

import type { NostrEvent } from "@nostrify/nostrify";

import type { ExportPage } from "./exportTransport";
import { dropOrphanAnnotations, type AnnotationStatus, type ExportModeration, type WithheldResult } from "./moderationMetadata";

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
}): Promise<{ events: NostrEvent[]; pageCount: number; failures: TFailure[]; moderation: ExportModeration }> {
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
  const annotations = new Map<string, AnnotationStatus>();
  let annotationPagesAvailable = 0;
  let annotationPagesUnsupported = 0;
  let invalidAnnotationCount = 0;
  let conflictingAnnotationCount = 0;

  function buildResult(withheld: WithheldResult) {
    const filtered = dropOrphanAnnotations(annotations, new Set(events.map((event) => event.id)));
    const annotationsStatus = annotationPagesAvailable === 0
      ? "unsupported" as const
      : annotationPagesUnsupported > 0 || invalidAnnotationCount > 0 || filtered.orphanCount > 0 || conflictingAnnotationCount > 0
        ? "incomplete" as const
        : "complete" as const;

    return {
      events,
      pageCount: pagesFetched,
      failures,
      moderation: {
        annotations: Array.from(filtered.annotations, ([eventId, status]) => ({ eventId, status })),
        annotationsStatus,
        invalidAnnotationCount,
        orphanAnnotationCount: filtered.orphanCount,
        conflictingAnnotationCount,
        withheld,
      },
    };
  }

  for (;;) {
    try {
      const page = await input.fetchPage(cursor, pageRetries);
      pagesFetched += 1;
      events.push(...page.data);
      if (page.moderationAnnotations.kind === "unsupported") {
        annotationPagesUnsupported += 1;
      } else {
        annotationPagesAvailable += 1;
        invalidAnnotationCount += page.moderationAnnotations.invalidCount;
        conflictingAnnotationCount += page.moderationAnnotations.conflictingCount;
        for (const [eventId, status] of page.moderationAnnotations.annotations) {
          const previous = annotations.get(eventId);
          if (previous && previous !== status) {
            conflictingAnnotationCount += 1;
            continue;
          }
          annotations.set(eventId, status);
        }
      }
      pageRetries = 0;
      input.onProgress?.({ pagesFetched, eventsFetched: events.length, retryCount });
      if (!page.pagination.has_more) return buildResult(page.withheld);
      if (!page.pagination.next_cursor) throw input.makeFailure("malformed-response");
      if (usedCursors.has(page.pagination.next_cursor)) {
        failures.push(input.makeFailure("stalled-cursor"));
        return buildResult({ kind: "unavailable" });
      }
      if (pagesFetched >= maxPages) {
        failures.push(input.makeFailure("page-limit", maxPages));
        return buildResult({ kind: "unavailable" });
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
      if (events.length > 0) return buildResult({ kind: "unavailable" });
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
