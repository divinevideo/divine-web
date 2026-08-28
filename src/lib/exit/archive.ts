// ABOUTME: Builds the downloadable account archive from exported Nostr events
// ABOUTME: Produces events.json, manifest.json, and media.json for the /exit/start flow

import type { NostrEvent } from "@nostrify/nostrify";

import { isHex64 } from "./hex";
import type { MediaDownloadResult, MediaVerification } from "./mediaDownloader";

export interface ArchiveFailure extends Error {
  code: string;
  status?: number;
}

export interface MediaReference {
  event_id: string;
  tag: string;
  url: string;
  sha256: string | null;
}

export interface ArchiveManifest {
  pubkey: string;
  generated_at: string;
  event_count: number;
  source_name: string;
  source_endpoint: string;
  page_count: number;
  failures: Array<{
    code: string;
    message: string;
    status?: number;
  }>;
  snapshot?: {
    enforcement_id: string;
    enforced_at: string | null;
    expires_at: string;
  };
  media?: MediaSummary;
}

export interface MediaSummary {
  media_total: number;
  media_verified: number;
  media_unverified: number;
  media_mismatched: number;
  media_failed: number;
}

export interface ArchivedMediaReference extends MediaReference {
  source_url: string;
  expected_sha256: string | null;
  computed_sha256: string | null;
  byte_size: number | null;
  content_type: string | null;
  archive_path: string | null;
  verification: MediaVerification;
  failure_reason?: string;
}

export interface ArchiveFiles {
  "events.json": NostrEvent[];
  "manifest.json": ArchiveManifest;
  "media.json": MediaReference[] | ArchivedMediaReference[];
  "media-checksums.txt"?: string;
}

const URL_TAGS = new Set(["url", "image", "thumb", "thumbnail"]);
const IMETA_URL_KEYS = new Set(["url", "image", "thumb", "thumbnail", "fallback"]);

function basenameHash(url: string): string | null {
  try {
    const parsed = new URL(url);
    const lastPart = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
    const hash = lastPart.split(".")[0];
    return isHex64(hash) ? hash.toLowerCase() : null;
  } catch {
    return null;
  }
}

function siblingHash(tags: string[][]): string | null {
  for (const tag of tags) {
    if (tag[0] === "x" && tag[1] && isHex64(tag[1])) {
      return tag[1].toLowerCase();
    }
  }

  return null;
}

function readImeta(tag: string[]): Array<{ url: string; sha256: string | null }> {
  let sha256: string | null = null;
  const urls: Array<{ key: string; url: string }> = [];

  const readValue = (key: string, body: string) => {
    if (IMETA_URL_KEYS.has(key) && body) {
      urls.push({ key, url: body });
    }
    if (key === "x" && isHex64(body)) {
      sha256 = body.toLowerCase();
    }
  };

  if (tag[1]?.includes(" ")) {
    for (const value of tag.slice(1)) {
      const [key, ...rest] = value.split(" ");
      readValue(key, rest.join(" "));
    }
  } else {
    for (let index = 1; index < tag.length; index += 2) {
      readValue(tag[index] ?? "", tag[index + 1] ?? "");
    }
  }

  return urls.map(({ key, url }) => ({
    url,
    sha256: basenameHash(url) ?? (key === "url" ? sha256 : null)
  }));
}

export function discoverMediaReferences(events: NostrEvent[]): MediaReference[] {
  const references: MediaReference[] = [];

  for (const event of events) {
    if (!event || !Array.isArray(event.tags)) {
      continue;
    }

    const eventHash = siblingHash(event.tags);

    for (const tag of event.tags) {
      if (!Array.isArray(tag)) {
        continue;
      }

      const [name, value] = tag;
      if (!name) {
        continue;
      }

      if (URL_TAGS.has(name) && value) {
        references.push({
          event_id: event.id,
          tag: name,
          url: value,
          sha256:
            tag.find((part) => isHex64(part))?.toLowerCase() ??
            basenameHash(value) ??
            (name === "url" ? eventHash : null)
        });
      }

      if (name === "imeta") {
        for (const imeta of readImeta(tag)) {
          references.push({
            event_id: event.id,
            tag: name,
            url: imeta.url,
            sha256: imeta.sha256
          });
        }
      }
    }
  }

  return references;
}

export function buildArchiveFiles(input: {
  events: NostrEvent[];
  pubkey: string;
  sourceEndpoint: string;
  pageCount: number;
  failures: ArchiveFailure[];
  sourceName?: string;
  snapshot?: ArchiveManifest["snapshot"];
  generatedAt?: Date;
}): ArchiveFiles {
  return {
    "events.json": input.events,
    "manifest.json": {
      pubkey: input.pubkey,
      generated_at: (input.generatedAt ?? new Date()).toISOString(),
      event_count: input.events.length,
      source_name: input.sourceName ?? "Divine relay",
      source_endpoint: input.sourceEndpoint,
      page_count: input.pageCount,
      failures: input.failures.map((failure) => ({
        code: failure.code,
        message: failure.message,
        status: failure.status
      })),
      ...(input.snapshot ? { snapshot: input.snapshot } : {}),
    },
    "media.json": discoverMediaReferences(input.events)
  };
}

export function mergeMediaResults(results: MediaDownloadResult[]): ArchivedMediaReference[] {
  return results.flatMap((result) => result.references.map((reference) => ({
    ...reference,
    source_url: result.source_url,
    expected_sha256: result.expected_sha256,
    computed_sha256: result.computed_sha256,
    byte_size: result.byte_size,
    content_type: result.content_type,
    archive_path: result.archive_path,
    verification: result.verification,
    ...(result.failure_reason ? { failure_reason: result.failure_reason } : {}),
  })));
}

export function summarizeMedia(results: MediaDownloadResult[]): MediaSummary {
  return {
    media_total: results.length,
    media_verified: results.filter((result) => result.verification === "verified").length,
    media_unverified: results.filter((result) => result.verification === "unverified").length,
    media_mismatched: results.filter((result) => result.verification === "hash-mismatch").length,
    media_failed: results.filter((result) => result.verification === "failed").length,
  };
}

export function createMediaChecksums(results: MediaDownloadResult[]): string {
  const lines = results
    .filter((result) => result.archive_path && (result.verification === "verified" || result.verification === "unverified"))
    .map((result) => `${result.computed_sha256}  ${result.archive_path}`);
  return lines.length ? `${lines.join("\n")}\n` : "";
}

export function completeArchiveMedia(files: ArchiveFiles, results: MediaDownloadResult[]): ArchiveFiles {
  return {
    ...files,
    "manifest.json": { ...files["manifest.json"], media: summarizeMedia(results) },
    "media.json": mergeMediaResults(results),
    "media-checksums.txt": createMediaChecksums(results),
  };
}

export function serializeArchiveFiles(files: ArchiveFiles): Record<string, string> {
  const serialized: Record<string, string> = {
    "events.json": `${JSON.stringify(files["events.json"], null, 2)}\n`,
    "manifest.json": `${JSON.stringify(files["manifest.json"], null, 2)}\n`,
    "media.json": `${JSON.stringify(files["media.json"], null, 2)}\n`
  };
  if (files["media-checksums.txt"] !== undefined) serialized["media-checksums.txt"] = files["media-checksums.txt"];
  return serialized;
}
