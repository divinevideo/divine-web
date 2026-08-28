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

// 4 is a NIP-04 direct message; 13 is the NIP-59 seal, which carries the
// sender's real pubkey and so is the one of these an owner export can return;
// 14 and 15 are NIP-17 chat and file messages; 1059 is the NIP-59 gift wrap.
const PRIVATE_MESSAGE_KINDS = new Set([4, 13, 14, 15, 1059]);
const DESTRUCTIVE_KINDS = new Set([5, 62]);

export function buildDestinationUrlMap(results: MirrorResult[]): Map<string, string> {
  const urls = new Map<string, string>();
  for (const result of results) {
    if (
      (result.verification !== "descriptor-verified" && result.verification !== "already-present")
      || !result.destination_url
    ) continue;
    for (const reference of result.references) {
      urls.set(reference.url, result.destination_url);
    }
  }
  return urls;
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

function replaceExact(value: string, urls: ReadonlyMap<string, string>): string {
  return urls.get(value) ?? value;
}

function rewriteImeta(tag: string[], urls: ReadonlyMap<string, string>): string[] {
  if (tag[1]?.includes(" ")) {
    return tag.map((value, index) => {
      if (index === 0) return value;
      const [key, ...body] = value.split(" ");
      if (!IMETA_URL_KEYS.has(key)) return value;
      const original = body.join(" ");
      const replacement = replaceExact(original, urls);
      return replacement === original ? value : `${key} ${replacement}`;
    });
  }

  return tag.map((value, index) => {
    if (index < 2 || index % 2 !== 0) return value;
    const key = tag[index - 1];
    return IMETA_URL_KEYS.has(key) ? replaceExact(value, urls) : value;
  });
}

function countRemainingMediaUrls(event: NostrEvent, urls: ReadonlyMap<string, string>): number {
  let count = 0;
  for (const tag of event.tags) {
    if (URL_TAGS.has(tag[0]) && tag[1] && !urls.has(tag[1])) count += 1;
    if (tag[0] !== "imeta") continue;
    if (tag[1]?.includes(" ")) {
      count += tag.slice(1).filter((value) => {
        const [key, ...body] = value.split(" ");
        return IMETA_URL_KEYS.has(key) && body.length > 0 && !urls.has(body.join(" "));
      }).length;
    } else {
      for (let index = 1; index < tag.length; index += 2) {
        if (IMETA_URL_KEYS.has(tag[index]) && tag[index + 1] && !urls.has(tag[index + 1])) count += 1;
      }
    }
  }
  count += profileMediaUrls(event).filter(({ url }) => !urls.has(url)).length;
  return count;
}

export function rewriteEventMedia(event: NostrEvent, urls: ReadonlyMap<string, string>): EventRewrite {
  const tags = event.tags.map((tag) => {
    if (URL_TAGS.has(tag[0]) && tag[1]) {
      const rewritten = [...tag];
      rewritten[1] = replaceExact(tag[1], urls);
      return rewritten;
    }
    return tag[0] === "imeta" ? rewriteImeta(tag, urls) : [...tag];
  });
  let content = event.content;
  for (const [source, destination] of urls) {
    content = content.split(source).join(destination);
  }
  const changed = content !== event.content || tags.some((tag, index) =>
    tag.some((value, part) => value !== event.tags[index][part]) || tag.length !== event.tags[index].length
  );
  return {
    template: { kind: event.kind, created_at: event.created_at, content, tags },
    changed,
    remainingMediaUrls: countRemainingMediaUrls(event, urls),
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
