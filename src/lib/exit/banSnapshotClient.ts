// ABOUTME: Checks and redeems pre-ban account snapshots with NIP-98 ownership proof
// ABOUTME: Keeps snapshot lifecycle, validation, and overloaded HTTP errors endpoint-specific

import type { NostrSigner } from "@nostrify/nostrify";

import { walkExportCursor, type CursorWalkProgress } from "./cursorWalk";
import { exportRetryDelayMs, readExportErrorBody, signedExportGet, validateExportPage, type ExportPage } from "./exportTransport";
import { isHex64 } from "./hex";

export type SnapshotLifecycleState = "available" | "absent" | "capture_failed" | "expired" | "temporarily_unavailable";

export interface SnapshotStatus {
  state: SnapshotLifecycleState;
  enforcement_id: string | null;
  enforced_at: string | null;
  created_at: string | null;
  expires_at: string | null;
  days_remaining: number | null;
}

export type SnapshotFailureCode = "invalid-pubkey" | "invalid-enforcement" | "bad-cursor" | "expired-cursor" | "auth-required" | "pubkey-mismatch" | "snapshot-unavailable" | "rate-limited" | "server-failure" | "malformed-response" | "network-failure" | "cancelled" | "stalled-cursor" | "page-limit";

export class BanSnapshotError extends Error {
  constructor(public readonly code: SnapshotFailureCode, message: string, public readonly status?: number, public readonly retryAfterMs?: number) {
    super(message);
    this.name = "BanSnapshotError";
  }
}

interface ClientBase { endpointBase: string; pubkey: string; signer: NostrSigner; fetcher?: typeof fetch; signal?: AbortSignal }
export interface RedeemSnapshotOptions extends ClientBase {
  enforcementId: string; limit?: number; sleep?: (ms: number) => Promise<void>; maxRateLimitRetries?: number;
  maxPages?: number; onProgress?: (progress: CursorWalkProgress) => void;
}

function clientError(code: "network-failure" | "malformed-response" | "stalled-cursor" | "page-limit", detail?: number) {
  const message = code === "network-failure"
    ? "The snapshot could not reach Divine. Check the connection and try again."
    : code === "malformed-response"
      ? "Divine did not provide the next snapshot page."
      : code === "stalled-cursor"
        ? "Divine stopped moving through the snapshot, so this archive ends where it stopped."
        : `This recovery stopped after ${detail} pages. Everything read up to that point is included.`;
  return new BanSnapshotError(code, message);
}

function buildUrl(endpointBase: string, pubkey: string, suffix: string) {
  return new URL(`${endpointBase.replace(/\/$/, "")}/api/users/${pubkey}/export/snapshot${suffix}`);
}

function validateTimestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validateStatus(value: unknown): SnapshotStatus {
  if (!value || typeof value !== "object") throw new BanSnapshotError("malformed-response", "Divine returned snapshot information this page could not read.");
  const status = value as Partial<SnapshotStatus>;
  const states: SnapshotLifecycleState[] = ["available", "absent", "capture_failed", "expired", "temporarily_unavailable"];
  if (!status.state || !states.includes(status.state)) throw new BanSnapshotError("malformed-response", "Divine returned an unknown snapshot state.");
  const timestamps = [status.enforced_at, status.created_at, status.expires_at];
  if (timestamps.some((value) => value !== null && value !== undefined && !validateTimestamp(value))) throw new BanSnapshotError("malformed-response", "Divine returned a snapshot date this page could not read.");
  if (status.enforcement_id !== null && status.enforcement_id !== undefined && !isHex64(status.enforcement_id)) throw new BanSnapshotError("malformed-response", "Divine returned a snapshot identifier this page could not read.");
  if (status.days_remaining !== null && status.days_remaining !== undefined && (!Number.isInteger(status.days_remaining) || status.days_remaining < 0)) throw new BanSnapshotError("malformed-response", "Divine returned an invalid snapshot lifetime.");
  if (status.state === "available" && (!status.enforcement_id || !status.created_at || !status.expires_at || status.days_remaining === null || status.days_remaining === undefined)) throw new BanSnapshotError("malformed-response", "Divine returned incomplete snapshot information.");
  return {
    state: status.state,
    enforcement_id: status.enforcement_id ?? null,
    enforced_at: status.enforced_at ?? null,
    created_at: status.created_at ?? null,
    expires_at: status.expires_at ?? null,
    days_remaining: status.days_remaining ?? null,
  };
}

function commonResponseError(status: number) {
  if (status === 401) return new BanSnapshotError("auth-required", "Sign in again, then check for a snapshot.", 401);
  return new BanSnapshotError("server-failure", "Divine could not check the snapshot right now. Try again later.", status);
}

export async function fetchSnapshotStatus(options: ClientBase): Promise<SnapshotStatus> {
  if (!isHex64(options.pubkey)) throw new BanSnapshotError("invalid-pubkey", "The account identifier is not valid.", 400);
  const url = buildUrl(options.endpointBase, options.pubkey, "/status").toString();
  const response = await signedExportGet({
    url, signer: options.signer, fetcher: options.fetcher ?? fetch, signal: options.signal,
    authFailure: () => new BanSnapshotError("auth-required", "This snapshot check could not be signed. Sign in again, then retry."),
    networkFailure: () => clientError("network-failure"),
    cancelled: () => new BanSnapshotError("cancelled", "The snapshot check was cancelled."),
  });
  if (response.status === 400) throw new BanSnapshotError("invalid-pubkey", "The account identifier is not valid.", 400);
  if (response.status === 403) throw new BanSnapshotError("pubkey-mismatch", "This sign-in does not match the account being checked.", 403);
  if (!response.ok) throw commonResponseError(response.status);
  try { return validateStatus(await response.json()); } catch (error) {
    if (error instanceof BanSnapshotError) throw error;
    throw new BanSnapshotError("malformed-response", "Divine returned snapshot information this page could not read.");
  }
}

function classifyRedeemBadRequest(body: string) {
  const normalized = body.toLowerCase();
  if (normalized.includes("expired") || normalized.includes("unknown cursor")) return new BanSnapshotError("expired-cursor", "The snapshot page expired. Start the recovery again.", 400);
  if (normalized.includes("cursor")) return new BanSnapshotError("bad-cursor", "The snapshot page token was not accepted.", 400);
  if (normalized.includes("enforcement")) return new BanSnapshotError("invalid-enforcement", "Divine did not recognize this snapshot identifier.", 400);
  return new BanSnapshotError("invalid-pubkey", "The account identifier is not valid.", 400);
}

async function fetchSnapshotPage(input: RedeemSnapshotOptions & { url: string; retryCount: number }): Promise<ExportPage> {
  const response = await signedExportGet({
    url: input.url, signer: input.signer, fetcher: input.fetcher ?? fetch, signal: input.signal,
    authFailure: () => new BanSnapshotError("auth-required", "This recovery could not be signed. Sign in again, then retry."),
    networkFailure: () => clientError("network-failure"),
    cancelled: () => new BanSnapshotError("cancelled", "The snapshot recovery was cancelled."),
  });
  const body = response.status === 400 || response.status === 403 ? await readExportErrorBody(response) : "";
  if (response.status === 400) throw classifyRedeemBadRequest(body);
  if (response.status === 401) throw new BanSnapshotError("auth-required", "Sign in again, then restart the recovery.", 401);
  if (response.status === 403 && body.toLowerCase().includes("own account")) throw new BanSnapshotError("pubkey-mismatch", "This sign-in does not match the account being recovered.", 403);
  if (response.status === 403) throw new BanSnapshotError("snapshot-unavailable", "The snapshot became unavailable, so this archive ends where recovery stopped.", 403);
  if (response.status === 429) throw new BanSnapshotError("rate-limited", "Divine asked this recovery to slow down. Wait a moment and try again.", 429, exportRetryDelayMs(response, input.retryCount));
  if (!response.ok) throw new BanSnapshotError("server-failure", "Divine could not finish this recovery right now. Try again later.", response.status);
  try { return validateExportPage(await response.json(), input.pubkey, () => new BanSnapshotError("malformed-response", "Divine returned snapshot data this page could not read.")); } catch (error) {
    if (error instanceof BanSnapshotError) throw error;
    throw new BanSnapshotError("malformed-response", "Divine returned snapshot data this page could not read.");
  }
}

export async function redeemSnapshotEvents(options: RedeemSnapshotOptions) {
  if (!isHex64(options.pubkey)) throw new BanSnapshotError("invalid-pubkey", "The account identifier is not valid.", 400);
  if (!isHex64(options.enforcementId)) throw new BanSnapshotError("invalid-enforcement", "The snapshot identifier is not valid.", 400);
  return walkExportCursor({
    fetchPage: (cursor, retryCount) => {
      const url = buildUrl(options.endpointBase, options.pubkey, "");
      url.searchParams.set("enforcement_id", options.enforcementId);
      url.searchParams.set("limit", String(options.limit ?? 500));
      if (cursor) url.searchParams.set("cursor", cursor);
      return fetchSnapshotPage({ ...options, url: url.toString(), retryCount });
    },
    isFailure: (error): error is BanSnapshotError => error instanceof BanSnapshotError,
    makeFailure: clientError,
    makeCancelledFailure: () => new BanSnapshotError("cancelled", "The snapshot recovery was cancelled."),
    cancelledCode: "cancelled", rateLimitedCode: "rate-limited", sleep: options.sleep, signal: options.signal,
    maxRateLimitRetries: options.maxRateLimitRetries, maxPages: options.maxPages, onProgress: options.onProgress,
  });
}
