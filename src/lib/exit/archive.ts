// ABOUTME: Builds the downloadable account archive from exported Nostr events
// ABOUTME: Produces events.json, manifest.json, and media.json for the /exit/start flow

import type { NostrEvent } from "@nostrify/nostrify";

import { isHex64 } from "./hex";
import type { OwnerExportError } from "./ownerExportClient";

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
}

export interface ArchiveFiles {
  "events.json": NostrEvent[];
  "manifest.json": ArchiveManifest;
  "media.json": MediaReference[];
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

  for (const value of tag.slice(1)) {
    const [key, ...rest] = value.split(" ");
    const body = rest.join(" ");

    if (IMETA_URL_KEYS.has(key) && body) {
      urls.push({ key, url: body });
    }
    if (key === "x" && isHex64(body)) {
      sha256 = body.toLowerCase();
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
  failures: OwnerExportError[];
  generatedAt?: Date;
}): ArchiveFiles {
  return {
    "events.json": input.events,
    "manifest.json": {
      pubkey: input.pubkey,
      generated_at: (input.generatedAt ?? new Date()).toISOString(),
      event_count: input.events.length,
      source_name: "Divine relay",
      source_endpoint: input.sourceEndpoint,
      page_count: input.pageCount,
      failures: input.failures.map((failure) => ({
        code: failure.code,
        message: failure.message,
        status: failure.status
      }))
    },
    "media.json": discoverMediaReferences(input.events)
  };
}

export function serializeArchiveFiles(files: ArchiveFiles): Record<string, string> {
  return {
    "events.json": `${JSON.stringify(files["events.json"], null, 2)}\n`,
    "manifest.json": `${JSON.stringify(files["manifest.json"], null, 2)}\n`,
    "media.json": `${JSON.stringify(files["media.json"], null, 2)}\n`
  };
}
