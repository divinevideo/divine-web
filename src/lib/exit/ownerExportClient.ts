// ABOUTME: Walks Divine's owner-export endpoint with NIP-98 auth and opaque cursors
// ABOUTME: Surfaces typed failures so the /exit/start page can explain what went wrong

import type { NostrEvent, NostrSigner } from "@nostrify/nostrify";

import { createNip98AuthHeader } from "@/lib/nip98Auth";

import { isHex64 } from "./hex";

export interface ExportPage {
  data: NostrEvent[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
}

export type ExportFailureCode =
  | "invalid-pubkey"
  | "bad-cursor"
  | "expired-cursor"
  | "auth-required"
  | "pubkey-mismatch"
  | "rate-limited"
  | "server-failure"
  | "malformed-response"
  | "network-failure"
  | "cancelled"
  | "stalled-cursor"
  | "page-limit";

export class OwnerExportError extends Error {
  constructor(
    public readonly code: ExportFailureCode,
    message: string,
    public readonly status?: number,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = "OwnerExportError";
  }
}

export interface ExportProgress {
  pagesFetched: number;
  eventsFetched: number;
  retryCount: number;
}

export interface OwnerExportResult {
  events: NostrEvent[];
  pageCount: number;
  failures: OwnerExportError[];
}

export interface OwnerExportClientOptions {
  endpointBase: string;
  pubkey: string;
  signer: NostrSigner;
  limit?: number;
  fetcher?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRateLimitRetries?: number;
  maxPages?: number;
  signal?: AbortSignal;
  onProgress?: (progress: ExportProgress) => void;
}

const DEFAULT_LIMIT = 500;
const DEFAULT_MAX_RATE_LIMIT_RETRIES = 3;

// A backstop against a server that never reports `has_more: false`, not a real
// account size. At the default page size this is five million events, so a
// genuine export should never reach it; hitting it returns what was collected
// rather than discarding it.
const DEFAULT_MAX_PAGES = 10_000;

function buildExportUrl(endpointBase: string, pubkey: string, limit: number, cursor?: string): string {
  const base = endpointBase.replace(/\/$/, "");
  const url = new URL(`${base}/api/users/${pubkey}/export/events`);
  url.searchParams.set("limit", String(limit));

  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  return url.toString();
}

// Cap a server-supplied Retry-After so a hostile or misconfigured header
// (e.g. `retry-after: 86400`) cannot stall the export for hours; backoffMs
// already floors the delay at 1000ms.
const MAX_RETRY_AFTER_MS = 60_000;

function retryDelayMs(response: Response, retryCount: number): number {
  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN;
  const backoffMs = Math.min(1000 * 2 ** retryCount, 8000);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(Math.max(retryAfterSeconds * 1000, backoffMs), MAX_RETRY_AFTER_MS);
  }

  return Math.max(backoffMs, 1000);
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function waitBeforeRetry(ms: number, sleep: (ms: number) => Promise<void>, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    await sleep(ms);
    return;
  }
  if (signal.aborted) {
    throw new OwnerExportError("cancelled", "The export was cancelled.");
  }

  let handleAbort: () => void = () => void 0;
  const aborted = new Promise<never>((_resolve, reject) => {
    handleAbort = () => reject(new OwnerExportError("cancelled", "The export was cancelled."));
    signal.addEventListener("abort", handleAbort, { once: true });
  });

  try {
    await Promise.race([sleep(ms), aborted]);
  } finally {
    signal.removeEventListener("abort", handleAbort);
  }
}

function classifyBadRequest(body: string): OwnerExportError {
  const normalized = body.toLowerCase();

  if (normalized.includes("expired") || normalized.includes("unknown cursor")) {
    return new OwnerExportError("expired-cursor", "The export page expired. Start the export again.", 400);
  }

  if (normalized.includes("cursor")) {
    return new OwnerExportError("bad-cursor", "The export page token was not accepted.", 400);
  }

  return new OwnerExportError("invalid-pubkey", "The account identifier is not valid.", 400);
}

const SIG_HEX = /^[0-9a-f]{128}$/i;

function validateEvent(value: unknown, expectedPubkey: string): NostrEvent {
  if (!value || typeof value !== "object") {
    throw new OwnerExportError("malformed-response", "Divine returned a response this tool could not read.");
  }

  const event = value as Partial<NostrEvent>;

  if (typeof event.id !== "string" || !isHex64(event.id)) {
    throw new OwnerExportError("malformed-response", "Divine returned an event identifier this tool could not read.");
  }

  if (typeof event.pubkey !== "string" || !isHex64(event.pubkey)) {
    throw new OwnerExportError("malformed-response", "Divine returned an account identifier this tool could not read.");
  }
  if (event.pubkey !== expectedPubkey) {
    throw new OwnerExportError("malformed-response", "Divine returned an event for a different account.");
  }

  if (typeof event.sig !== "string" || !SIG_HEX.test(event.sig)) {
    throw new OwnerExportError("malformed-response", "Divine returned an event signature this tool could not read.");
  }

  if (typeof event.created_at !== "number" || typeof event.kind !== "number" || typeof event.content !== "string") {
    throw new OwnerExportError("malformed-response", "Divine returned a response this tool could not read.");
  }

  if (
    !Array.isArray(event.tags) ||
    event.tags.some((tag) => !Array.isArray(tag) || tag.some((part) => typeof part !== "string"))
  ) {
    throw new OwnerExportError("malformed-response", "Divine returned a response this tool could not read.");
  }

  return event as NostrEvent;
}

function validatePage(value: unknown, expectedPubkey: string): ExportPage {
  if (!value || typeof value !== "object") {
    throw new OwnerExportError("malformed-response", "Divine returned a response this tool could not read.");
  }

  const candidate = value as Partial<ExportPage>;

  if (!Array.isArray(candidate.data) || !candidate.pagination || typeof candidate.pagination !== "object") {
    throw new OwnerExportError("malformed-response", "Divine returned a response this tool could not read.");
  }

  if (typeof candidate.pagination.has_more !== "boolean") {
    throw new OwnerExportError("malformed-response", "Divine returned pagination this tool could not read.");
  }

  const nextCursor = candidate.pagination.next_cursor;
  if (nextCursor !== null && nextCursor !== undefined && typeof nextCursor !== "string") {
    throw new OwnerExportError("malformed-response", "Divine returned pagination this tool could not read.");
  }

  return {
    data: candidate.data.map((event) => validateEvent(event, expectedPubkey)),
    pagination: {
      has_more: candidate.pagination.has_more,
      next_cursor: nextCursor ?? null
    }
  };
}

async function fetchPage(
  url: string,
  signer: NostrSigner,
  fetcher: typeof fetch,
  expectedPubkey: string,
  signal?: AbortSignal,
  rateLimitRetryCount = 0
): Promise<ExportPage> {
  if (signal?.aborted) {
    throw new OwnerExportError("cancelled", "The export was cancelled.");
  }

  const authHeader = await createNip98AuthHeader(signer, url, "GET");

  if (!authHeader) {
    throw new OwnerExportError(
      "auth-required",
      "This export could not be signed. If your account is restricted, appeal first. Otherwise sign in again, then restart the export."
    );
  }

  let response: Response;
  try {
    response = await fetcher(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json"
      },
      signal
    });
  } catch {
    if (signal?.aborted) {
      throw new OwnerExportError("cancelled", "The export was cancelled.");
    }
    throw new OwnerExportError("network-failure", "The export could not reach Divine. Check the connection and try again.");
  }

  if (response.status === 400) {
    throw classifyBadRequest(await readErrorBody(response));
  }
  if (response.status === 401) {
    throw new OwnerExportError("auth-required", "Sign in again, then restart the export.", 401);
  }
  if (response.status === 403) {
    throw new OwnerExportError("pubkey-mismatch", "This sign-in does not match the account being exported.", 403);
  }
  if (response.status === 429) {
    throw new OwnerExportError(
      "rate-limited",
      "Divine asked this export to slow down. Wait a moment and try again.",
      429,
      retryDelayMs(response, rateLimitRetryCount)
    );
  }
  if (response.status >= 500) {
    throw new OwnerExportError("server-failure", "Divine could not finish this export right now. Try again later.", response.status);
  }
  if (!response.ok) {
    throw new OwnerExportError("server-failure", "Divine could not finish this export right now. Try again later.", response.status);
  }

  try {
    return validatePage(await response.json(), expectedPubkey);
  } catch (error) {
    if (error instanceof OwnerExportError) {
      throw error;
    }
    throw new OwnerExportError("malformed-response", "Divine returned a response this tool could not read.");
  }
}

export async function exportOwnerEvents(options: OwnerExportClientOptions): Promise<OwnerExportResult> {
  const {
    endpointBase,
    pubkey,
    signer,
    fetcher = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    limit = DEFAULT_LIMIT,
    maxRateLimitRetries = DEFAULT_MAX_RATE_LIMIT_RETRIES,
    maxPages = DEFAULT_MAX_PAGES,
    signal,
    onProgress
  } = options;

  if (!isHex64(pubkey)) {
    throw new OwnerExportError("invalid-pubkey", "The account identifier is not valid.", 400);
  }

  const events: NostrEvent[] = [];
  const failures: OwnerExportError[] = [];
  const usedCursors = new Set<string>();
  let cursor: string | undefined;
  let pagesFetched = 0;
  let retryCount = 0;
  let rateLimitRetriesForPage = 0;

  for (;;) {
    const url = buildExportUrl(endpointBase, pubkey, limit, cursor);

    try {
      const page = await fetchPage(url, signer, fetcher, pubkey, signal, rateLimitRetriesForPage);
      pagesFetched += 1;
      events.push(...page.data);
      rateLimitRetriesForPage = 0;
      onProgress?.({ pagesFetched, eventsFetched: events.length, retryCount });

      if (!page.pagination.has_more) {
        return { events, pageCount: pagesFetched, failures };
      }

      if (!page.pagination.next_cursor) {
        throw new OwnerExportError("malformed-response", "Divine did not provide the next export page.");
      }

      const nextCursor = page.pagination.next_cursor;

      // A cursor we have already requested with means the server is not
      // advancing. That is a definite protocol violation rather than a guess,
      // so stop here and keep everything collected so far.
      if (usedCursors.has(nextCursor)) {
        failures.push(
          new OwnerExportError(
            "stalled-cursor",
            "Divine stopped moving through the export, so this archive ends where it stopped."
          )
        );
        return { events, pageCount: pagesFetched, failures };
      }

      if (pagesFetched >= maxPages) {
        failures.push(
          new OwnerExportError(
            "page-limit",
            `This export stopped after ${maxPages} pages. Everything read up to that point is included.`
          )
        );
        return { events, pageCount: pagesFetched, failures };
      }

      usedCursors.add(nextCursor);
      cursor = nextCursor;
    } catch (error) {
      if (
        error instanceof OwnerExportError &&
        error.code === "rate-limited" &&
        rateLimitRetriesForPage < maxRateLimitRetries
      ) {
        retryCount += 1;
        rateLimitRetriesForPage += 1;
        onProgress?.({ pagesFetched, eventsFetched: events.length, retryCount });
        await waitBeforeRetry(error.retryAfterMs ?? 1000, sleep, signal);
        continue;
      }

      if (error instanceof OwnerExportError && error.code === "cancelled") {
        throw error;
      }

      const failure =
        error instanceof OwnerExportError
          ? error
          : new OwnerExportError(
              "network-failure",
              "The export could not reach Divine. Check the connection and try again."
            );

      failures.push(failure);

      // Keep a partial archive rather than discarding pages already collected.
      // Media is content-addressed and the walk is idempotent, so an incomplete
      // archive is still useful and re-running it costs nothing. With nothing
      // collected there is nothing to keep, so the failure is the whole story.
      if (events.length > 0) {
        return { events, pageCount: pagesFetched, failures };
      }

      throw failure;
    }
  }
}
