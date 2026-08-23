import type { NostrEvent } from "@nostrify/nostrify";
import { describe, expect, it } from "vitest";

import { archivedVideoCreatedAt, oldestArchivedVideoCreatedAt } from "./archiveAge";

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

describe("archivedVideoCreatedAt", () => {
  it("uses created-at even when publication metadata is older", () => {
    expect(archivedVideoCreatedAt(event(200, [["published_at", "100"]]))).toBe(200);
  });

  it("ignores non-video events", () => {
    expect(archivedVideoCreatedAt(event(100, [], 1))).toBeNull();
  });
});

describe("oldestArchivedVideoCreatedAt", () => {
  it("returns the oldest video created-at in an archive", () => {
    expect(oldestArchivedVideoCreatedAt([
      event(300),
      event(400, [["published_at", "100"]]),
      event(50, [], 1),
    ])).toBe(300);
  });

  it("returns null when the archive has no videos", () => {
    expect(oldestArchivedVideoCreatedAt([event(50, [], 1)])).toBeNull();
  });
});
