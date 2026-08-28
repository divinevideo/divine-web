// ABOUTME: Provides shared authenticated transport and response validation for account exports
// ABOUTME: Leaves endpoint-specific status classification and user-facing errors to each client

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

export async function signedExportGet(input: {
  url: string;
  signer: NostrSigner;
  fetcher: typeof fetch;
  signal?: AbortSignal;
  authFailure: () => Error;
  networkFailure: () => Error;
  cancelled: () => Error;
}): Promise<Response> {
  if (input.signal?.aborted) throw input.cancelled();

  const authHeader = await createNip98AuthHeader(input.signer, input.url, "GET");
  if (!authHeader) throw input.authFailure();

  try {
    return await input.fetcher(input.url, {
      method: "GET",
      headers: { Authorization: authHeader, Accept: "application/json" },
      signal: input.signal,
    });
  } catch {
    if (input.signal?.aborted) throw input.cancelled();
    throw input.networkFailure();
  }
}

const SIG_HEX = /^[0-9a-f]{128}$/i;

export function validateExportPage(
  value: unknown,
  expectedPubkey: string,
  malformed: (detail: string) => Error,
): ExportPage {
  if (!value || typeof value !== "object") throw malformed("response");
  const candidate = value as Partial<ExportPage>;
  if (!Array.isArray(candidate.data) || !candidate.pagination || typeof candidate.pagination !== "object") {
    throw malformed("response");
  }
  if (typeof candidate.pagination.has_more !== "boolean") throw malformed("pagination");
  const nextCursor = candidate.pagination.next_cursor;
  if (nextCursor !== null && nextCursor !== undefined && typeof nextCursor !== "string") {
    throw malformed("pagination");
  }

  const data = candidate.data.map((value) => {
    if (!value || typeof value !== "object") throw malformed("response");
    const event = value as Partial<NostrEvent>;
    if (typeof event.id !== "string" || !isHex64(event.id)) throw malformed("event identifier");
    if (typeof event.pubkey !== "string" || !isHex64(event.pubkey)) throw malformed("account identifier");
    if (event.pubkey !== expectedPubkey) throw malformed("event for a different account");
    if (typeof event.sig !== "string" || !SIG_HEX.test(event.sig)) throw malformed("event signature");
    if (typeof event.created_at !== "number" || typeof event.kind !== "number" || typeof event.content !== "string") {
      throw malformed("response");
    }
    if (!Array.isArray(event.tags) || event.tags.some((tag) => !Array.isArray(tag) || tag.some((part) => typeof part !== "string"))) {
      throw malformed("response");
    }
    return event as NostrEvent;
  });

  return { data, pagination: { has_more: candidate.pagination.has_more, next_cursor: nextCursor ?? null } };
}

export async function readExportErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export function exportRetryDelayMs(response: Response, retryCount: number): number {
  const retryAfterSeconds = Number(response.headers.get("retry-after"));
  const backoffMs = Math.min(1000 * 2 ** retryCount, 8000);
  // Bound a hostile or misconfigured Retry-After so one response cannot stall
  // an export for hours while retaining exponential backoff as the floor.
  return Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
    ? Math.min(Math.max(retryAfterSeconds * 1000, backoffMs), 60_000)
    : Math.max(backoffMs, 1000);
}
