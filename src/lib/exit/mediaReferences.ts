// ABOUTME: Identifies portable media references shared by archive discovery and event rewriting
// ABOUTME: Safely reads profile picture and banner URLs from kind-0 metadata

import type { NostrEvent } from "@nostrify/nostrify";

export const URL_TAGS = new Set(["url", "image", "thumb", "thumbnail"]);
export const IMETA_URL_KEYS = new Set(["url", "image", "thumb", "thumbnail", "fallback"]);

const PROFILE_MEDIA_KEYS = ["picture", "banner"] as const;

export interface ProfileMediaUrl {
  key: (typeof PROFILE_MEDIA_KEYS)[number];
  url: string;
}

export function profileMediaUrls(event: Pick<NostrEvent, "kind" | "content">): ProfileMediaUrl[] {
  if (event.kind !== 0) return [];

  try {
    const metadata: unknown = JSON.parse(event.content);
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];

    const values = metadata as Record<string, unknown>;
    return PROFILE_MEDIA_KEYS.flatMap((key) => {
      const value = values[key];
      return typeof value === "string" && value.trim() ? [{ key, url: value }] : [];
    });
  } catch {
    return [];
  }
}
