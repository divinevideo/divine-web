import type { NostrEvent, NostrSigner } from "@nostrify/nostrify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { openDestinationRelay } from "./relayConnection";
import {
  prepareSignedPointers,
  publishPointersToRelay,
  summarizePointerResults,
} from "./discoveryPointerPublisher";

vi.mock("./relayConnection", () => ({ openDestinationRelay: vi.fn() }));

const ownerPubkey = "a".repeat(64);
const signedPointers = [
  { kind: 10002, label: "Relay list", event: { kind: 10002 } as NostrEvent },
  { kind: 10063, label: "Blossom server list", event: { kind: 10063 } as NostrEvent },
];

function signer(): NostrSigner {
  return {
    signEvent: vi.fn(async (template) => ({
      ...template,
      id: "b".repeat(64),
      pubkey: ownerPubkey,
      sig: "c".repeat(128),
    } as NostrEvent)),
  } as unknown as NostrSigner;
}

describe("discovery pointer publication", () => {
  const publish = vi.fn();
  const close = vi.fn();

  beforeEach(() => {
    publish.mockReset().mockResolvedValue({ status: "accepted" });
    close.mockReset().mockResolvedValue(undefined);
    vi.mocked(openDestinationRelay).mockReset().mockReturnValue({ publish, close });
  });

  it("signs each pointer once before relay fan-out", async () => {
    const testSigner = signer();
    const prepared = await prepareSignedPointers({
      ownerPubkey,
      signer: testSigner,
      pointers: [
        { kind: 10002, label: "Relay list", template: { kind: 10002, created_at: 1, content: "", tags: [] } },
        { kind: 10063, label: "Blossom server list", template: { kind: 10063, created_at: 1, content: "", tags: [] } },
      ],
    });

    await Promise.all([
      publishPointersToRelay({ target: { relay: "wss://one.example/", isDiscoveryRelay: true }, pointers: prepared.signed, signer: testSigner, signal: new AbortController().signal }),
      publishPointersToRelay({ target: { relay: "wss://two.example/", isDiscoveryRelay: true }, pointers: prepared.signed, signer: testSigner, signal: new AbortController().signal }),
    ]);

    expect(testSigner.signEvent).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledTimes(4);
    expect(close).toHaveBeenCalledTimes(2);
  });

  it("rejects a signed pointer for another account", async () => {
    const wrongSigner = {
      signEvent: vi.fn(async (template) => ({
        ...template,
        id: "b".repeat(64),
        pubkey: "d".repeat(64),
        sig: "c".repeat(128),
      } as NostrEvent)),
    } as unknown as NostrSigner;

    const prepared = await prepareSignedPointers({
      ownerPubkey,
      signer: wrongSigner,
      pointers: [{ kind: 10002, label: "Relay list", template: { kind: 10002, created_at: 1, content: "", tags: [] } }],
    });

    expect(prepared.signed).toEqual([]);
    expect(prepared.failures[0]).toMatchObject({ status: "signing-failed", reason: expect.stringContaining("different account") });
  });

  it("keeps accepted results when the relay stops answering mid-publication", async () => {
    publish
      .mockResolvedValueOnce({ status: "accepted" })
      .mockRejectedValueOnce(new Error("socket closed"));

    await expect(publishPointersToRelay({
      target: { relay: "wss://indexer.example/", isDiscoveryRelay: true },
      pointers: signedPointers,
      signer: signer(),
      signal: new AbortController().signal,
    })).resolves.toEqual([
      expect.objectContaining({ kind: 10002, status: "published" }),
      expect.objectContaining({ kind: 10063, status: "publish-failed", reason: expect.stringContaining("stopped answering") }),
    ]);
  });

  it("rethrows relay failures when publication was cancelled", async () => {
    const controller = new AbortController();
    publish.mockImplementationOnce(async () => {
      controller.abort();
      throw new DOMException("cancelled", "AbortError");
    });

    await expect(publishPointersToRelay({
      target: { relay: "wss://indexer.example/", isDiscoveryRelay: true },
      pointers: signedPointers,
      signer: signer(),
      signal: controller.signal,
    })).rejects.toThrow("cancelled");
    expect(close).toHaveBeenCalledOnce();
  });

  it("marks duplicate relay responses as accepted discovery", () => {
    const summaries = summarizePointerResults({
      pointers: [{ kind: 10002, label: "Relay list" }],
      targets: [
        { relay: "wss://destination.example/", isDiscoveryRelay: false },
        { relay: "wss://indexer.example/", isDiscoveryRelay: true },
      ],
      results: [
        { kind: 10002, label: "Relay list", relay: "wss://destination.example/", isDiscoveryRelay: false, status: "published" },
        { kind: 10002, label: "Relay list", relay: "wss://indexer.example/", isDiscoveryRelay: true, status: "duplicate", reason: "already stored" },
      ],
    });

    expect(summaries[0]).toMatchObject({ status: "published", acceptedDiscoveryRelays: ["wss://indexer.example/"] });
  });

  it("does not call destination-only acceptance discoverable", () => {
    const summaries = summarizePointerResults({
      pointers: [{ kind: 10002, label: "Relay list" }],
      targets: [
        { relay: "wss://destination.example/", isDiscoveryRelay: false },
        { relay: "wss://indexer.example/", isDiscoveryRelay: true },
      ],
      results: [
        { kind: 10002, label: "Relay list", relay: "wss://destination.example/", isDiscoveryRelay: false, status: "published" },
        { kind: 10002, label: "Relay list", relay: "wss://indexer.example/", isDiscoveryRelay: true, status: "publish-failed", reason: "blocked" },
      ],
    });

    expect(summaries[0]).toMatchObject({ status: "destination-only", acceptedDiscoveryRelays: [] });
  });
});
