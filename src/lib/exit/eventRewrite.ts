// ABOUTME: Rewrites exported event media and references for a destination relay
// ABOUTME: Keeps unchanged signed events intact and identifies events unsafe to republish

import { NKinds, type NostrEvent } from "@nostrify/nostrify";

import { IMETA_URL_KEYS, profileMediaUrls, URL_TAGS } from "./mediaReferences";
import type { MirrorResult } from "./mirrorClient";

export type EventTemplate = Omit<NostrEvent, "id" | "pubkey" | "sig">;

export interface EventRewrite {
  template: EventTemplate;
  changed: boolean;
  remainingMediaUrls: number;
}

export interface DestinationRewrite {
  urls: Map<string, string>;
  confirmedOrigins: Set<string>;
  unconfirmedUrls: Set<string>;
}

interface MediaTagField {
  encoding: "direct" | "spaced" | "alternating";
  index: number;
  key: string;
  url: string;
}

// 4 is a NIP-04 direct message; 13 is the NIP-59 seal, which carries the
// sender's real pubkey and so is the one of these an owner export can return;
// 14 and 15 are NIP-17 chat and file messages; 1059 is the NIP-59 gift wrap.
const PRIVATE_MESSAGE_KINDS = new Set([4, 13, 14, 15, 1059]);
const DESTRUCTIVE_KINDS = new Set([5, 62]);

export function isConfirmedDestinationCopy(
  result: MirrorResult,
): result is MirrorResult & { destination_url: string } {
  return (
    ["descriptor-verified", "upload-verified", "already-present"].includes(result.verification)
    && typeof result.destination_url === "string"
    && result.destination_url.trim().length > 0
  );
}

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function buildDestinationRewrite(results: MirrorResult[]): DestinationRewrite {
  const urls = new Map<string, string>();
  const confirmedOrigins = new Set<string>();
  const unconfirmedUrls = new Set<string>();
  for (const result of results) {
    if (isConfirmedDestinationCopy(result)) {
      // Use the reported delivery origin because a Blossom server may return a
      // separate CDN URL; the summary trusts that destination-provided origin.
      const origin = originOf(result.destination_url);
      if (origin) confirmedOrigins.add(origin);
      for (const reference of result.references) {
        urls.set(reference.url, result.destination_url);
      }
    } else {
      for (const reference of result.references) {
        unconfirmedUrls.add(reference.url);
      }
    }
  }
  return { urls, confirmedOrigins, unconfirmedUrls };
}

export function republishSkipReason(kind: number): string | null {
  if (PRIVATE_MESSAGE_KINDS.has(kind)) return "Encrypted private messages stay on their original relays.";
  if (kind >= 20_000 && kind < 30_000) return "Temporary authentication and ephemeral events are not portable posts.";
  if (DESTRUCTIVE_KINDS.has(kind)) return "Deletion and vanish requests are not replayed during a move.";
  return null;
}

export function republishCreatedAt(event: NostrEvent, now: number): number {
  return NKinds.replaceable(event.kind) || NKinds.addressable(event.kind)
    ? Math.max(event.created_at + 1, now)
    : event.created_at;
}

function mediaTagFields(tag: string[]): MediaTagField[] {
  if (URL_TAGS.has(tag[0]) && tag[1]) {
    return [{ encoding: "direct", index: 1, key: tag[0], url: tag[1] }];
  }
  if (tag[0] !== "imeta") return [];
  if (tag[1]?.includes(" ")) {
    return tag.flatMap((value, index) => {
      if (index === 0) return [];
      const [key, ...body] = value.split(" ");
      const url = body.join(" ");
      return IMETA_URL_KEYS.has(key) && url ? [{ encoding: "spaced" as const, index, key, url }] : [];
    });
  }
  const fields: MediaTagField[] = [];
  for (let index = 1; index < tag.length; index += 2) {
    const key = tag[index];
    const url = tag[index + 1];
    if (IMETA_URL_KEYS.has(key) && url) {
      fields.push({ encoding: "alternating", index: index + 1, key, url });
    }
  }
  return fields;
}

function rewriteMediaTag(tag: string[], fields: MediaTagField[], urls: ReadonlyMap<string, string>): string[] {
  const rewritten = [...tag];
  for (const field of fields) {
    const replacement = urls.get(field.url);
    if (!replacement) continue;
    rewritten[field.index] = field.encoding === "spaced" ? `${field.key} ${replacement}` : replacement;
  }
  return rewritten;
}

function isRemainingMediaUrl(url: string, rewrite: DestinationRewrite): boolean {
  if (rewrite.urls.has(url)) return false;
  if (rewrite.unconfirmedUrls.has(url)) return true;
  const origin = originOf(url);
  return origin === null || !rewrite.confirmedOrigins.has(origin);
}

function rewriteProfileContent(event: NostrEvent, urls: ReadonlyMap<string, string>): string {
  const references = profileMediaUrls(event);
  if (references.length === 0) return event.content;

  const metadata = JSON.parse(event.content) as Record<string, unknown>;
  let changed = false;
  for (const { key, url } of references) {
    const replacement = urls.get(url);
    if (!replacement || replacement === url) continue;
    metadata[key] = replacement;
    changed = true;
  }
  return changed ? JSON.stringify(metadata) : event.content;
}

export function rewriteEventMedia(event: NostrEvent, rewrite: DestinationRewrite): EventRewrite {
  const tags = event.tags.map((tag) => {
    const fields = mediaTagFields(tag);
    return fields.length > 0 ? rewriteMediaTag(tag, fields, rewrite.urls) : [...tag];
  });
  let content = rewriteProfileContent(event, rewrite.urls);
  for (const [source, destination] of rewrite.urls) {
    content = content.split(source).join(destination);
  }
  const changed = content !== event.content || tags.some((tag, index) =>
    tag.some((value, part) => value !== event.tags[index][part]) || tag.length !== event.tags[index].length
  );
  return {
    template: { kind: event.kind, created_at: event.created_at, content, tags },
    changed,
    remainingMediaUrls: event.tags
      .flatMap(mediaTagFields)
      .filter((field) => isRemainingMediaUrl(field.url, rewrite)).length
      + profileMediaUrls(event).filter(({ url }) => isRemainingMediaUrl(url, rewrite)).length,
  };
}

export function referencedEventIds(event: NostrEvent): string[] {
  const ids = event.tags
    .filter((tag) => (tag[0] === "e" || tag[0] === "E" || tag[0] === "q") && tag[1])
    .map((tag) => tag[1]);
  if (event.kind === 6 || event.kind === 16) {
    try {
      const repost = JSON.parse(event.content) as Partial<NostrEvent>;
      if (typeof repost.id === "string") ids.push(repost.id);
    } catch {
      // Non-JSON generic repost content is valid and has nothing to remap here.
    }
  }
  return [...new Set(ids)];
}

export function rewriteEventReferences(
  template: EventTemplate,
  idMap: ReadonlyMap<string, NostrEvent>,
): { template: EventTemplate; changed: boolean } {
  let changed = false;
  const tags = template.tags.map((tag) => {
    if ((tag[0] === "e" || tag[0] === "E" || tag[0] === "q") && idMap.has(tag[1])) {
      changed = true;
      const rewritten = [...tag];
      rewritten[1] = idMap.get(tag[1])!.id;
      return rewritten;
    }
    return tag;
  });
  let content = template.content;
  if (template.kind === 6 || template.kind === 16) {
    try {
      const repost = JSON.parse(content) as NostrEvent;
      const replacement = idMap.get(repost.id);
      if (replacement) {
        content = JSON.stringify(replacement);
        changed = true;
      }
    } catch {
      // Non-JSON generic repost content is valid and has nothing to remap here.
    }
  }
  return { template: { ...template, tags, content }, changed };
}
