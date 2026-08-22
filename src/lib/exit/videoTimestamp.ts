// ABOUTME: Re-dates old NIP-71 videos for relay acceptance before event signing
// ABOUTME: Keeps their first publication time in video-specific metadata

import type { NostrEvent } from "@nostrify/nostrify";

import type { EventTemplate } from "./eventRewrite";

const VIDEO_KINDS = new Set([21, 22, 34235, 34236]);

function publicationTags(event: NostrEvent, tags: string[][]): string[][] {
  const publishedAt = tags.findIndex((tag) => tag[0] === "published_at");
  if (publishedAt === -1) return [...tags, ["published_at", String(event.created_at)]];
  if (/^\d+$/.test(tags[publishedAt][1] ?? "")) return tags;
  return tags.map((tag, index) => index === publishedAt ? ["published_at", String(event.created_at)] : tag);
}

export function redateArchivedVideo(
  original: NostrEvent,
  template: EventTemplate,
  now: number,
  cutoff: number,
): { template: EventTemplate; redated: boolean } {
  if (!VIDEO_KINDS.has(original.kind) || original.created_at >= cutoff) {
    return { template, redated: false };
  }
  return {
    template: { ...template, created_at: now, tags: publicationTags(original, template.tags) },
    redated: true,
  };
}
