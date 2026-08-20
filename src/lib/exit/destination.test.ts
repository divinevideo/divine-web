import { describe, expect, it } from "vitest";

import { DestinationError, normalizeDestinationUrl } from "./destination";

describe("normalizeDestinationUrl", () => {
  it("normalizes an HTTPS server and removes trailing slashes", () => {
    expect(normalizeDestinationUrl("  https://blossom.example/path///  ")).toBe("https://blossom.example/path");
  });

  it.each([
    ["not a url", "invalid-url"],
    ["http://blossom.example", "insecure-scheme"],
    ["https://user:pass@blossom.example", "embedded-credentials"],
    ["https://blossom.example?token=secret", "query-not-allowed"],
    ["https://blossom.example#place", "fragment-not-allowed"],
  ])("rejects %s", (value, code) => {
    expect(() => normalizeDestinationUrl(value)).toThrow(DestinationError);
    try {
      normalizeDestinationUrl(value);
    } catch (error) {
      expect(error).toMatchObject({ code });
    }
  });
});
