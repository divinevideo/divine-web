import type { NostrEvent } from "@nostrify/nostrify";
import { describe, expect, it } from "vitest";

import { redateArchivedVideo } from "./videoTimestamp";

function event(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: "a".repeat(64),
    pubkey: "b".repeat(64),
    sig: "c".repeat(128),
    kind: 34236,
    created_at: 100,
    content: "A loop",
    tags: [["d", "loop"]],
    ...overrides,
  };
}

describe("redateArchivedVideo", () => {
  it("re-dates an old video and preserves its declared publication date", () => {
    const original = event({ tags: [["d", "loop"], ["published_at", "80"]] });
    const result = redateArchivedVideo(original, {
      ...original,
      tags: original.tags,
    }, 200, 150);

    expect(result).toEqual({
      redated: true,
      template: expect.objectContaining({ created_at: 200, tags: [["d", "loop"], ["published_at", "80"]] }),
    });
  });

  it("records the original created-at when old video metadata has no valid publication date", () => {
    const original = event({ tags: [["d", "loop"], ["published_at", "invalid"]] });
    const result = redateArchivedVideo(original, original, 200, 150);

    expect(result.template.tags).toEqual([["d", "loop"], ["published_at", "100"]]);
  });

  it.each([1, 7, 16, 1111, 30_005])("does not re-date old non-video kind %s", (kind) => {
    const original = event({ kind });
    expect(redateArchivedVideo(original, original, 200, 150)).toEqual({ template: original, redated: false });
  });

  it("does not re-date a video inside the relay age window", () => {
    const original = event({ created_at: 160 });
    expect(redateArchivedVideo(original, original, 200, 150)).toEqual({ template: original, redated: false });
  });
});
