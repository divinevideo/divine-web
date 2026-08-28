// ABOUTME: Downloads archive media sequentially and verifies content-addressed bytes
// ABOUTME: Tries alternate sources for one hash and never leaks viewer auth off Divine media

import type { NostrSigner } from "@nostrify/nostrify";

import type { MediaReference } from "./archive";
import { fetchAndHashBlob } from "./mediaBlob";
import { groupMediaReferences } from "./mediaReferences";

export type MediaVerification = "verified" | "unverified" | "hash-mismatch" | "failed";

export interface MediaDownloadResult {
  references: MediaReference[];
  source_url: string;
  expected_sha256: string | null;
  computed_sha256: string | null;
  byte_size: number | null;
  content_type: string | null;
  archive_path: string | null;
  verification: MediaVerification;
  failure_reason?: string;
}

export interface MediaProgress {
  completed: number;
  total: number;
  result: MediaDownloadResult;
}

interface DownloadOptions {
  references: MediaReference[];
  signer?: NostrSigner | null;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  onFile(path: string, bytes: Uint8Array): Promise<void>;
  onProgress?(progress: MediaProgress): void;
}

const EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4", "video/webm": "webm", "image/jpeg": "jpg", "image/png": "png",
  "image/webp": "webp", "image/gif": "gif", "application/vnd.apple.mpegurl": "m3u8",
};

function extension(contentType: string | null): string {
  return EXTENSIONS[contentType?.split(";")[0].trim().toLowerCase() ?? ""] ?? "bin";
}

export async function downloadArchiveMedia(options: DownloadOptions): Promise<MediaDownloadResult[]> {
  const batches = groupMediaReferences(options.references);
  const results: MediaDownloadResult[] = [];
  for (const references of batches) {
    const expectedHash = references[0].sha256;
    const candidates = [...new Set(references.map((reference) => reference.url))];
    let result: MediaDownloadResult | null = null;
    let mismatch: { result: MediaDownloadResult; bytes: Uint8Array } | null = null;
    const failures: string[] = [];
    for (const url of candidates) {
      if (options.signal?.aborted) { failures.push("Download cancelled"); break; }
      try {
        const response = await fetchAndHashBlob({
          url,
          expectedSha256: expectedHash,
          signer: options.signer,
          signal: options.signal,
          fetcher: options.fetcher,
        });
        const computedHash = response.computedSha256;
        const status: MediaVerification = expectedHash ? (expectedHash === computedHash ? "verified" : "hash-mismatch") : "unverified";
        const folder = status === "hash-mismatch" ? "media/mismatched" : status === "unverified" ? "media/unverified" : "media";
        const archivePath = `${folder}/${status === "hash-mismatch" ? expectedHash : computedHash}.${extension(response.contentType)}`;
        if (status === "hash-mismatch" && candidates.length > 1) {
          failures.push(`${url}: hash mismatch`);
          mismatch = { bytes: response.bytes, result: { references, source_url: response.finalUrl,
            expected_sha256: expectedHash, computed_sha256: computedHash, byte_size: response.bytes.length,
            content_type: response.contentType, archive_path: archivePath, verification: status } };
          continue;
        }
        await options.onFile(archivePath, response.bytes);
        result = { references, source_url: response.finalUrl, expected_sha256: expectedHash, computed_sha256: computedHash,
          byte_size: response.bytes.length, content_type: response.contentType, archive_path: archivePath, verification: status };
        break;
      } catch (error) {
        failures.push(`${url}: ${error instanceof Error ? error.message : "download failed"}`);
      }
    }
    if (!result && mismatch) {
      try {
        await options.onFile(mismatch.result.archive_path!, mismatch.bytes);
        result = mismatch.result;
      } catch (error) {
        failures.push(`quarantine write: ${error instanceof Error ? error.message : "failed"}`);
      }
    }
    result ??= { references, source_url: candidates[0], expected_sha256: expectedHash, computed_sha256: null,
      byte_size: null, content_type: null, archive_path: null, verification: "failed", failure_reason: failures.join("; ") };
    results.push(result);
    options.onProgress?.({ completed: results.length, total: batches.length, result });
  }
  return results;
}
