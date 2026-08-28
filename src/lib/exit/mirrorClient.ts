// ABOUTME: Mirrors exported media to a user-selected Blossom server with BUD-04
// ABOUTME: Uses the first real copy as a capability canary and records partial failures

import type { NostrSigner } from "@nostrify/nostrify";

import { createBlossomUploadAuthHeader } from "@/lib/blossomAuth";

import type { MediaReference } from "./archive";
import { DestinationError } from "./destination";
import { fetchAndHashBlob, type HashedBlob } from "./mediaBlob";
import { groupMediaReferences } from "./mediaReferences";

export type MirrorVerification = "descriptor-verified" | "upload-verified" | "already-present" | "unverified" | "hash-mismatch" | "failed" | "skipped";

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
  alreadyPresent: number;
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

const MAX_HASHLESS_IMAGE_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_TAGS = new Set(["picture", "banner"]);
const UPLOADABLE_IMAGE_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

function isHlsManifest(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return false;
  }
}

function defaultWait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Mirror cancelled", "AbortError"));
      return;
    }
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

// BUD-01 lets a server attach a human-readable `X-Reason` to any error. It is
// diagnostic text only, never control flow, so it is bounded and stripped of
// line breaks before it reaches the page.
function serverReason(response: Response): string {
  const reason = response.headers.get("x-reason")?.replace(/\s+/g, " ").trim();
  return reason ? ` The server said: ${reason.slice(0, 200)}` : "";
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

async function requestMirror(
  references: MediaReference[],
  sha256: string,
  options: MirrorOptions,
): Promise<Response | DestinationError> {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? defaultWait;
  for (let attempt = 0; ; attempt += 1) {
    const authorization = await createBlossomUploadAuthHeader(options.signer, sha256);
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

async function requestUpload(blob: HashedBlob, options: MirrorOptions): Promise<Response | DestinationError> {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? defaultWait;
  for (let attempt = 0; ; attempt += 1) {
    const authorization = await createBlossomUploadAuthHeader(options.signer, blob.computedSha256);
    try {
      const response = await fetcher(`${options.destination}/upload`, {
        method: "PUT",
        signal: options.signal,
        headers: { Authorization: authorization, "Content-Type": blob.contentType! },
        body: blob.bytes,
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
    // BUD-01 lets a blob endpoint answer with 307/308 to a CDN, and guarantees
    // the redirect target still carries the same sha256. Refusing to follow
    // reported every CDN-backed destination as unverified.
    const response = await (options.fetcher ?? fetch)(descriptor.url, {
      method: "HEAD",
      signal: options.signal,
      redirect: "follow",
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

function isDestinationBlobUrl(sourceUrl: string, destination: string, sha256: string): boolean {
  try {
    const source = new URL(sourceUrl);
    const pathHash = source.pathname.match(/^\/([a-f0-9]{64})(?:\.[^/]+)?$/i)?.[1];
    return source.origin === new URL(destination).origin && pathHash?.toLowerCase() === sha256.toLowerCase();
  } catch {
    return false;
  }
}

function readBlobHeadSize(response: Response): number | null {
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (!contentType || contentType === "text/html" || contentType === "application/xhtml+xml") return null;
  const contentLength = response.headers.get("content-length");
  if (contentLength === null || contentLength.trim() === "") return null;
  const byteSize = Number(contentLength);
  return Number.isSafeInteger(byteSize) && byteSize >= 0 ? byteSize : null;
}

async function probeExistingBlob(
  references: MediaReference[],
  sha256: string,
  options: MirrorOptions,
): Promise<MirrorResult | null> {
  const canonicalUrl = `${options.destination}/${sha256.toLowerCase()}`;
  try {
    const response = await (options.fetcher ?? fetch)(canonicalUrl, {
      method: "HEAD",
      signal: options.signal,
      redirect: "follow",
    });
    const byteSize = readBlobHeadSize(response);
    if (byteSize === null) return null;
    const sourceUrl = references[0].url;
    const destinationUrl = references.find((reference) =>
      isDestinationBlobUrl(reference.url, options.destination, sha256)
    )?.url ?? canonicalUrl;
    return {
      references,
      source_url: sourceUrl,
      destination_url: destinationUrl,
      expected_sha256: sha256,
      destination_sha256: sha256.toLowerCase(),
      byte_size: byteSize,
      verification: "already-present",
    };
  } catch {
    if (options.signal?.aborted) throw new DOMException("Mirror cancelled", "AbortError");
    return null;
  }
}

async function mirrorOne(
  references: MediaReference[],
  expectedHash: string,
  options: MirrorOptions,
): Promise<{ result: MirrorResult; destinationError: DestinationError | null }> {
  const response = await requestMirror(references, expectedHash, options);
  if (response instanceof DestinationError) {
    const existing = await probeExistingBlob(references, expectedHash, options);
    if (existing) return { result: existing, destinationError: null };
    return { result: failedResult(references, "failed", response.message), destinationError: response };
  }
  const destinationError = response.status === 429
    ? new DestinationError("rate-limited", `${options.destination} is rate limiting media copies. Try again later.`, 429)
    : destinationFailure(response.status, options.destination);
  if (destinationError) {
    const existing = await probeExistingBlob(references, expectedHash, options);
    if (existing) return { result: existing, destinationError: null };
    return { result: failedResult(references, "failed", destinationError.message), destinationError };
  }
  if (!response.ok) {
    const existing = await probeExistingBlob(references, expectedHash, options);
    if (existing) return { result: existing, destinationError: null };
    return {
      result: failedResult(references, "failed", `The destination refused this file (HTTP ${response.status}).${serverReason(response)}`),
      destinationError: null,
    };
  }
  const descriptor = await readDescriptor(response);
  if (!descriptor) {
    const existing = await probeExistingBlob(references, expectedHash, options);
    if (existing) return { result: existing, destinationError: null };
    return { result: failedResult(references, "failed", "The destination returned an invalid blob descriptor."), destinationError: null };
  }
  if (expectedHash && descriptor.sha256 !== expectedHash.toLowerCase()) {
    return { result: failedResult(references, "hash-mismatch", "The destination reported a different hash.", descriptor), destinationError: null };
  }
  return { result: await verifyReadback(references, descriptor, options), destinationError: null };
}

function skippedResult(references: MediaReference[], reason: string): MirrorResult {
  return {
    references,
    source_url: references[0].url,
    destination_url: null,
    expected_sha256: references[0].sha256,
    destination_sha256: null,
    byte_size: null,
    verification: "skipped",
    reason,
  };
}

async function uploadHashlessImage(references: MediaReference[], options: MirrorOptions): Promise<MirrorResult> {
  let blob: HashedBlob;
  try {
    blob = await fetchAndHashBlob({
      url: references[0].url,
      signer: options.signer,
      signal: options.signal,
      fetcher: options.fetcher,
      maxBytes: MAX_HASHLESS_IMAGE_BYTES,
    });
  } catch (error) {
    if (options.signal?.aborted) throw new DOMException("Mirror cancelled", "AbortError");
    const reason = error instanceof Error ? error.message : "download failed";
    if (reason.includes("larger than")) {
      return skippedResult(references, "The hashless image is larger than 5 MB, so it was not uploaded.");
    }
    return failedResult(references, "failed", `The source image could not be read: ${reason}`);
  }
  if (!blob.contentType || !UPLOADABLE_IMAGE_TYPES.has(blob.contentType)) {
    return skippedResult(references, "The hashless source is not a supported image, so it was not uploaded.");
  }

  const response = await requestUpload(blob, options);
  if (response instanceof DestinationError) {
    return failedResult(references, "failed", response.message);
  }
  if (response.status === 404 || response.status === 405 || response.status === 501) {
    return skippedResult(references, `${options.destination} does not support browser uploads.`);
  }
  if (!response.ok) {
    return failedResult(references, "failed", `The destination refused this upload (HTTP ${response.status}).${serverReason(response)}`);
  }
  const descriptor = await readDescriptor(response);
  if (!descriptor) return failedResult(references, "failed", "The destination returned an invalid blob descriptor.");
  if (descriptor.sha256 !== blob.computedSha256 || descriptor.size !== blob.bytes.length) {
    return failedResult(references, "hash-mismatch", "The destination reported different uploaded bytes.", descriptor);
  }
  return {
    references,
    source_url: blob.finalUrl,
    destination_url: descriptor.url,
    expected_sha256: null,
    destination_sha256: descriptor.sha256,
    byte_size: descriptor.size,
    verification: "upload-verified",
  };
}

export async function mirrorArchiveMedia(options: MirrorOptions): Promise<MirrorResult[]> {
  const groups = groupMediaReferences(options.references);
  const results: MirrorResult[] = [];
  let copyAttempts = 0;
  for (const references of groups) {
    if (options.signal?.aborted) throw new DOMException("Mirror cancelled", "AbortError");
    const reference = references[0];
    let result: MirrorResult;
    if (isHlsManifest(reference.url)) {
      result = skippedResult(references, "Streaming manifests are generated derivatives and were not copied.");
    } else if (!reference.sha256) {
      result = references.some(({ tag }) => PROFILE_IMAGE_TAGS.has(tag))
        ? await uploadHashlessImage(references, options)
        : skippedResult(references, "The source did not advertise a SHA-256 hash, so a secure copy could not be authorized.");
    } else {
      const outcome = await mirrorOne(references, reference.sha256, options);
      if (outcome.result.verification !== "already-present") {
        if (copyAttempts === 0 && outcome.destinationError) throw outcome.destinationError;
        copyAttempts += 1;
      }
      result = outcome.result;
    }
    results.push(result);
    options.onProgress?.({ completed: results.length, total: groups.length, result });
  }
  return results;
}

export function summarizeMirrorResults(results: MirrorResult[]): MirrorSummary {
  return {
    mirrored: results.filter((result) => result.verification === "descriptor-verified" || result.verification === "upload-verified").length,
    alreadyPresent: results.filter((result) => result.verification === "already-present").length,
    failed: results.filter((result) => result.verification === "failed" || result.verification === "hash-mismatch").length,
    skipped: results.filter((result) => result.verification === "skipped").length,
    unverified: results.filter((result) => result.verification === "unverified").length,
  };
}
