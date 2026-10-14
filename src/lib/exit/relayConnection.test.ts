import type { NostrEvent, NostrSigner } from "@nostrify/nostrify";
import { describe, expect, it, vi } from "vitest";

import { openDestinationRelay } from "./relayConnection";

const RELAY = "wss://relay.example/nostr";
const EVENT = { id: "a".repeat(64), pubkey: "b".repeat(64), sig: "c".repeat(128), kind: 1, created_at: 1, content: "", tags: [] };

function signer(): NostrSigner {
  return {
    signEvent: vi.fn(async (template) => ({ ...template, id: "d".repeat(64), pubkey: "b".repeat(64), sig: "e".repeat(128) })),
  } as unknown as NostrSigner;
}

describe("openDestinationRelay", () => {
  it("publishes, maps duplicate refusals, and closes", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const event = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("duplicate: stored"));
    const session = openDestinationRelay({ destination: RELAY, signer: signer(), relayFactory: () => ({ event, close }) });
    await expect(session.publish(EVENT)).resolves.toEqual({ status: "accepted" });
    await expect(session.publish(EVENT)).resolves.toEqual({ status: "duplicate", message: "The relay already has this event." });
    await session.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it("signs NIP-42 challenges for the full relay URL", async () => {
    const testSigner = signer();
    let auth: ((challenge: string) => Promise<NostrEvent>) | undefined;
    openDestinationRelay({
      destination: RELAY,
      signer: testSigner,
      relayFactory: (_url, options) => {
        auth = options.auth;
        return { event: vi.fn(), close: vi.fn().mockResolvedValue(undefined) };
      },
    });
    await auth!("challenge value");
    expect(testSigner.signEvent).toHaveBeenCalledWith(expect.objectContaining({
      kind: 22242,
      tags: [["relay", RELAY], ["challenge", "challenge value"]],
    }));
  });

  it("bounds retries and reports the last rate limit", async () => {
    const event = vi.fn().mockRejectedValue(new Error("rate-limited: slow"));
    const wait = vi.fn().mockResolvedValue(undefined);
    const session = openDestinationRelay({
      destination: RELAY,
      signer: signer(),
      relayFactory: () => ({ event, close: vi.fn().mockResolvedValue(undefined) }),
      wait,
      maxRateLimitRetries: 1,
    });
    await expect(session.publish(EVENT)).resolves.toMatchObject({ status: "failed", code: "rate-limited" });
    expect(event).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledOnce();
  });
});
