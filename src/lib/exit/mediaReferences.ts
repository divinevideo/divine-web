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

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export function profileMediaUrls(event: Pick<NostrEvent, "kind" | "content">): ProfileMediaUrl[] {
  if (event.kind !== 0) return [];

  try {
    const metadata: unknown = JSON.parse(event.content);
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];

    const values = metadata as Record<string, unknown>;
    return PROFILE_MEDIA_KEYS.flatMap((key) => {
      const value = values[key];
      // Profile fields are free-form strings. `banner` in particular commonly
      // holds a theme color such as "0x27c58b" rather than an image; only treat
      // values that parse as http(s) URLs as portable media, so a color is not
      // reported as a failed download or an unmirrored reference.
      return typeof value === "string" && isHttpUrl(value) ? [{ key, url: value }] : [];
    });
  } catch {
    return [];
  }
}
