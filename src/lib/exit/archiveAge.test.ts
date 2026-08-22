import type { NostrEvent } from "@nostrify/nostrify";
import { describe, expect, it } from "vitest";

import { archivedVideoDate, oldestArchivedVideoDate } from "./archiveAge";

function event(createdAt: number, tags: string[][] = [], kind = 34236): NostrEvent {
  return {
    id: "a".repeat(64),
    pubkey: "b".repeat(64),
    sig: "c".repeat(128),
    kind,
    created_at: createdAt,
    content: "",
    tags,
  };
}

describe("archivedVideoDate", () => {
  it("prefers a valid NIP-71 publication date", () => {
    expect(archivedVideoDate(event(200, [["published_at", "100"]]))).toBe(100);
  });

  it("falls back to created-at for videos without valid publication metadata", () => {
    expect(archivedVideoDate(event(200))).toBe(200);
    expect(archivedVideoDate(event(200, [["published_at", "not-a-date"]]))).toBe(200);
  });

  it("ignores non-video events", () => {
    expect(archivedVideoDate(event(100, [], 1))).toBeNull();
  });
});

describe("oldestArchivedVideoDate", () => {
  it("returns the oldest video date in an archive", () => {
    expect(oldestArchivedVideoDate([
      event(300),
      event(400, [["published_at", "100"]]),
      event(50, [], 1),
    ])).toBe(100);
  });

  it("returns null when the archive has no videos", () => {
    expect(oldestArchivedVideoDate([event(50, [], 1)])).toBeNull();
  });
});
