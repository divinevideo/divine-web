import { describe, expect, it } from "vitest";

import { DestinationError } from "./destination";
import { normalizeRelayDestinationUrl } from "./relayDestination";

describe("normalizeRelayDestinationUrl", () => {
  it("normalizes a public secure relay and preserves its path and query", () => {
    expect(normalizeRelayDestinationUrl(" WSS://Relay.Example/nostr?tenant=one ")).toBe(
      "wss://relay.example/nostr?tenant=one",
    );
  });

  it.each([
    ["not a url", "invalid-relay-url"],
    ["ws://relay.example", "insecure-relay-scheme"],
    ["https://relay.example", "insecure-relay-scheme"],
    ["wss://user:pass@relay.example", "embedded-credentials"],
    ["wss://relay.example/#hidden", "fragment-not-allowed"],
    ["wss://localhost/relay", "private-relay-host"],
    ["wss://127.0.0.1/relay", "private-relay-host"],
    ["wss://http//evil.example", "private-relay-host"],
  ])("rejects %s", (value, code) => {
    expect(() => normalizeRelayDestinationUrl(value)).toThrowError(
      expect.objectContaining<Partial<DestinationError>>({ code: code as DestinationError["code"] }),
    );
  });
});
