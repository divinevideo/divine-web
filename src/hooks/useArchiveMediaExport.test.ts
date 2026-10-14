import { describe, expect, it } from "vitest";

import type { MediaSummary } from "@/lib/exit/archive";

import { classifyMediaExport } from "./useArchiveMediaExport";

function summary(overrides: Partial<MediaSummary> = {}): MediaSummary {
  return {
    media_total: 4,
    media_verified: 4,
    media_unverified: 0,
    media_mismatched: 0,
    media_failed: 0,
    ...overrides,
  };
}

describe("classifyMediaExport", () => {
  it("distinguishes clean, degraded, all-failed, and empty exports", () => {
    expect(classifyMediaExport(summary())).toBe("complete");
    expect(classifyMediaExport(summary({ media_verified: 3, media_failed: 1 }))).toBe("partial");
    expect(classifyMediaExport(summary({ media_verified: 3, media_mismatched: 1 }))).toBe("partial");
    expect(classifyMediaExport(summary({ media_verified: 0, media_failed: 4 }))).toBe("no-media");
    expect(classifyMediaExport(summary({ media_total: 0, media_verified: 0 }))).toBe("empty");
  });
});
