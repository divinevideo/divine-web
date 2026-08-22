import type { NostrEvent } from "@nostrify/nostrify";
import { describe, expect, it } from "vitest";

import {
  BLOSSOM_SERVER_LIST_KIND,
  buildBlossomServerListTemplate,
  buildRelayListTemplate,
  MAX_REPLACEMENT_FUTURE_SKEW_SECONDS,
  newestPointerCreatedAt,
  pointerPublishTargets,
  RELAY_LIST_KIND,
  replacementCreatedAt,
} from "./discoveryPointers";

const OWNER = "a".repeat(64);

function event(kind: number, createdAt: number, pubkey = OWNER): NostrEvent {
  return { id: "b".repeat(64), pubkey, sig: "c".repeat(128), kind, created_at: createdAt, content: "", tags: [] };
}

describe("discovery pointer templates", () => {
  it("builds destination-only NIP-65 and BUD-03 lists", () => {
    expect(buildRelayListTemplate("wss://relay.example/", 10)).toEqual({ kind: 10002, created_at: 10, content: "", tags: [["r", "wss://relay.example/"]] });
    expect(buildBlossomServerListTemplate("https://blossom.example", 11)).toEqual({ kind: 10063, created_at: 11, content: "", tags: [["server", "https://blossom.example"]] });
    expect([RELAY_LIST_KIND, BLOSSOM_SERVER_LIST_KIND]).not.toContain(1063);
    expect(JSON.stringify([buildRelayListTemplate("wss://relay.example/", 10), buildBlossomServerListTemplate("https://blossom.example", 11)])).not.toMatch(/relay\.divine\.video|media\.divine\.video/);
  });

  it("finds only the owner's newest pointer", () => {
    expect(newestPointerCreatedAt([
      event(RELAY_LIST_KIND, 10),
      event(RELAY_LIST_KIND, 20),
      event(RELAY_LIST_KIND, 99, "d".repeat(64)),
      event(BLOSSOM_SERVER_LIST_KIND, 30),
    ], RELAY_LIST_KIND, OWNER)).toBe(20);
  });

  it("publishes destination first and deduplicates normalized discovery relays", () => {
    expect(pointerPublishTargets({
      relayDestination: "wss://relay.example",
      discoveryRelays: ["WSS://RELAY.EXAMPLE/", "wss://indexer.example"],
    })).toEqual([
      { relay: "wss://relay.example/", isDiscoveryRelay: true },
      { relay: "wss://indexer.example/", isDiscoveryRelay: true },
    ]);
  });

  it("distinguishes a custom destination from discovery relays", () => {
    expect(pointerPublishTargets({
      relayDestination: "wss://destination.example",
      discoveryRelays: ["wss://indexer.example"],
    })).toEqual([
      { relay: "wss://destination.example/", isDiscoveryRelay: false },
      { relay: "wss://indexer.example/", isDiscoveryRelay: true },
    ]);
  });

  it("beats older and equal timestamps and blocks future-dated pointers", () => {
    expect(replacementCreatedAt({ nowSeconds: 20, newestSeconds: null })).toEqual({ createdAt: 20 });
    expect(replacementCreatedAt({ nowSeconds: 20, newestSeconds: 10 })).toEqual({ createdAt: 20 });
    expect(replacementCreatedAt({ nowSeconds: 20, newestSeconds: 20, toleranceSeconds: 60 })).toEqual({ createdAt: 21 });
    expect(replacementCreatedAt({ nowSeconds: 20, newestSeconds: 21 })).toMatchObject({ blocked: true });
    expect(replacementCreatedAt({ nowSeconds: 20, newestSeconds: 20, toleranceSeconds: 1 })).toEqual({ createdAt: 21 });
    expect(replacementCreatedAt({
      nowSeconds: 20,
      newestSeconds: 21,
      toleranceSeconds: MAX_REPLACEMENT_FUTURE_SKEW_SECONDS,
    })).toMatchObject({ blocked: true });
  });
});
