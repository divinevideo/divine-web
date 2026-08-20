// ABOUTME: Mirrors exported media to a user-selected Blossom server with BUD-04
// ABOUTME: Uses the first real copy as a capability canary and records partial failures

import type { NostrSigner } from "@nostrify/nostrify";

import { createBlossomUploadAuthHeader } from "@/lib/blossomAuth";

import type { MediaReference } from "./archive";
import { DestinationError } from "./destination";

export type MirrorVerification = "descriptor-verified" | "unverified" | "hash-mismatch" | "failed" | "skipped";

export interface MirrorResult {
  references: MediaReference[];
  source_url: string;
  destination_url: string | null;
  expected_sha256: string | null;
  destination_sha256: string | null;
  byte_size: number | null;
  verification: MirrorVerification;
  reason?: string;
}

export interface MirrorProgress {
  completed: number;
  total: number;
  result: MirrorResult;
}

export interface MirrorSummary {
  mirrored: number;
  failed: number;
  skipped: number;
  unverified: number;
}

interface BlobDescriptor {
  url: string;
  sha256: string;
  size: number;
}

interface MirrorOptions {
  destination: string;
  references: MediaReference[];
  signer: NostrSigner;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  maxRateLimitRetries?: number;
  onProgress?(progress: MirrorProgress): void;
}

function groupReferences(references: MediaReference[]): MediaReference[][] {
  const grouped = new Map<string, MediaReference[]>();
  for (const reference of references) {
    const key = reference.sha256 ? `hash:${reference.sha256}` : `url:${reference.url}`;
    grouped.set(key, [...(grouped.get(key) ?? []), reference]);
  }
  return [...grouped.values()];
}

function isHlsManifest(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return false;
  }
}

function defaultWait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timeout);
      reject(new DOMException("Mirror cancelled", "AbortError"));
    }, { once: true });
  });
}

function retryDelay(response: Response): number {
  const value = response.headers.get("retry-after");
  if (!value) return 1000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? 1000 : Math.max(0, date - Date.now());
}

function destinationFailure(status: number, destination: string): DestinationError | null {
  if (status === 401 || status === 403) {
    return new DestinationError("auth-required", `${destination} needs account access before it can mirror media.`, status);
  }
  if (status === 404 || status === 405 || status === 501) {
    return new DestinationError("no-mirror-support", `${destination} does not support Blossom media mirroring.`, status);
  }
  return null;
}

function parseDescriptor(value: unknown): BlobDescriptor | null {
  if (!value || typeof value !== "object") return null;
  const descriptor = value as Partial<BlobDescriptor>;
  if (typeof descriptor.url !== "string" || typeof descriptor.sha256 !== "string" || typeof descriptor.size !== "number") return null;
  if (!/^[a-f0-9]{64}$/i.test(descriptor.sha256) || descriptor.size < 0) return null;
  try {
    if (new URL(descriptor.url).protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { url: descriptor.url, sha256: descriptor.sha256.toLowerCase(), size: descriptor.size };
}

function failedResult(
  references: MediaReference[],
  verification: Extract<MirrorVerification, "failed" | "hash-mismatch">,
  reason: string,
  descriptor?: BlobDescriptor,
): MirrorResult {
  return {
    references,
    source_url: references[0].url,
    destination_url: descriptor?.url ?? null,
    expected_sha256: references[0].sha256,
    destination_sha256: descriptor?.sha256 ?? null,
    byte_size: descriptor?.size ?? null,
    verification,
    reason,
  };
}

async function requestMirror(references: MediaReference[], options: MirrorOptions): Promise<Response | DestinationError> {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? defaultWait;
  for (let attempt = 0; ; attempt += 1) {
    const authorization = await createBlossomUploadAuthHeader(options.signer, references[0].sha256 ?? undefined);
    try {
      const response = await fetcher(`${options.destination}/mirror`, {
        method: "PUT",
        signal: options.signal,
        headers: { Authorization: authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ url: references[0].url }),
      });
      if (response.status !== 429 || attempt >= (options.maxRateLimitRetries ?? 2)) return response;
      await wait(retryDelay(response), options.signal);
    } catch (error) {
      if (options.signal?.aborted) throw new DOMException("Mirror cancelled", "AbortError");
      if (!(error instanceof TypeError)) throw error;
      return new DestinationError("unreachable", `Your browser couldn't reach ${options.destination}. The server may be down, or it may not accept requests from other websites.`);
    }
  }
}

async function readDescriptor(response: Response): Promise<BlobDescriptor | null> {
  try {
    return parseDescriptor(await response.json());
  } catch {
    return null;
  }
}

async function verifyReadback(
  references: MediaReference[],
  descriptor: BlobDescriptor,
  options: MirrorOptions,
): Promise<MirrorResult> {
  const expectedHash = references[0].sha256;
  try {
    const response = await (options.fetcher ?? fetch)(descriptor.url, {
      method: "HEAD",
      signal: options.signal,
      redirect: "error",
    });
    const size = response.headers.get("content-length");
    if (expectedHash && response.ok && size !== null && Number(size) === descriptor.size) {
      return { references, source_url: references[0].url, destination_url: descriptor.url, expected_sha256: expectedHash,
        destination_sha256: descriptor.sha256, byte_size: descriptor.size, verification: "descriptor-verified" };
    }
  } catch {
    if (options.signal?.aborted) throw new DOMException("Mirror cancelled", "AbortError");
  }
  return { references, source_url: references[0].url, destination_url: descriptor.url, expected_sha256: expectedHash,
    destination_sha256: descriptor.sha256, byte_size: descriptor.size, verification: "unverified",
    reason: expectedHash
      ? "The destination reported the expected hash, but browser readback could not be confirmed."
      : "The source did not advertise a hash, so the destination copy could not be compared." };
}

async function mirrorOne(
  references: MediaReference[],
  options: MirrorOptions,
): Promise<{ result: MirrorResult; destinationError: DestinationError | null }> {
  const expectedHash = references[0].sha256;
  const response = await requestMirror(references, options);
  if (response instanceof DestinationError) {
    return { result: failedResult(references, "failed", response.message), destinationError: response };
  }
  const destinationError = response.status === 429
    ? new DestinationError("rate-limited", `${options.destination} is rate limiting media copies. Try again later.`, 429)
    : destinationFailure(response.status, options.destination);
  if (destinationError) {
    return { result: failedResult(references, "failed", destinationError.message), destinationError };
  }
  if (!response.ok) {
    return { result: failedResult(references, "failed", `The destination refused this file (HTTP ${response.status}).`), destinationError: null };
  }
  const descriptor = await readDescriptor(response);
  if (!descriptor) {
    return { result: failedResult(references, "failed", "The destination returned an invalid blob descriptor."), destinationError: null };
  }
  if (expectedHash && descriptor.sha256 !== expectedHash.toLowerCase()) {
    return { result: failedResult(references, "hash-mismatch", "The destination reported a different hash.", descriptor), destinationError: null };
  }
  return { result: await verifyReadback(references, descriptor, options), destinationError: null };
}

export async function mirrorArchiveMedia(options: MirrorOptions): Promise<MirrorResult[]> {
  const groups = groupReferences(options.references);
  const work = groups.filter(([reference]) => !isHlsManifest(reference.url));
  const skipped = groups.filter(([reference]) => isHlsManifest(reference.url)).map((references): MirrorResult => ({
    references, source_url: references[0].url, destination_url: null, expected_sha256: references[0].sha256,
    destination_sha256: null, byte_size: null, verification: "skipped", reason: "Streaming manifests are generated derivatives and were not copied.",
  }));
  const results: MirrorResult[] = [...skipped];
  for (let index = 0; index < work.length; index += 1) {
    if (options.signal?.aborted) throw new DOMException("Mirror cancelled", "AbortError");
    const outcome = await mirrorOne(work[index], options);
    if (index === 0 && outcome.destinationError) throw outcome.destinationError;
    results.push(outcome.result);
    options.onProgress?.({ completed: results.length, total: groups.length, result: outcome.result });
  }
  return results;
}

export function summarizeMirrorResults(results: MirrorResult[]): MirrorSummary {
  return {
    mirrored: results.filter((result) => result.verification === "descriptor-verified").length,
    failed: results.filter((result) => result.verification === "failed" || result.verification === "hash-mismatch").length,
    skipped: results.filter((result) => result.verification === "skipped").length,
    unverified: results.filter((result) => result.verification === "unverified").length,
  };
}
