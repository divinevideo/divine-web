import type { NostrEvent, NostrSigner } from "@nostrify/nostrify";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildArchiveFiles } from "@/lib/exit/archive";
import { fixturePubkey, makeFixtureEvent } from "@/lib/exit/__fixtures__/exportFixtures";
import { openDestinationRelay } from "@/lib/exit/relayConnection";

import { useDiscoveryPointers } from "./useDiscoveryPointers";

vi.mock("@/lib/exit/relayConnection", () => ({ openDestinationRelay: vi.fn() }));

const files = buildArchiveFiles({ events: [makeFixtureEvent()], pubkey: fixturePubkey, sourceEndpoint: "https://api.divine.video", pageCount: 1, failures: [] });

function signer(sign?: (template: Omit<NostrEvent, "id" | "pubkey" | "sig">) => Promise<NostrEvent>): NostrSigner {
  return {
    signEvent: vi.fn(sign ?? (async (template) => ({ ...template, id: "a".repeat(64), pubkey: fixturePubkey, sig: "b".repeat(128) }))),
  } as unknown as NostrSigner;
}

describe("useDiscoveryPointers", () => {
  const publishes = new Map<string, ReturnType<typeof vi.fn>>();
  const closes = new Map<string, ReturnType<typeof vi.fn>>();

  beforeEach(() => {
    publishes.clear();
    closes.clear();
    vi.mocked(openDestinationRelay).mockReset().mockImplementation(({ destination }) => {
      const publish = vi.fn().mockResolvedValue({ status: "accepted" });
      const close = vi.fn().mockResolvedValue(undefined);
      publishes.set(destination, publish);
      closes.set(destination, close);
      return { publish, close };
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("publishes both pointers to every deduplicated target and signs only twice", async () => {
    const testSigner = signer();
    const { result } = renderHook(() => useDiscoveryPointers({ files, relayDestination: "wss://relay.divine.video/", blossomDestination: "https://blossom.example", signer: testSigner }));

    await act(async () => result.current.start());

    expect(openDestinationRelay).toHaveBeenCalledTimes(4);
    expect([...publishes.values()].every((publish) => publish.mock.calls.length === 2)).toBe(true);
    expect(testSigner.signEvent).toHaveBeenCalledTimes(2);
    expect(result.current.summaries.every((summary) => summary.status === "published")).toBe(true);
  });

  it("keeps a signer refusal local to one pointer", async () => {
    let calls = 0;
    const testSigner = signer(async (template) => {
      calls += 1;
      if (calls === 1) throw new Error("not allowed");
      return { ...template, id: "a".repeat(64), pubkey: fixturePubkey, sig: "b".repeat(128) };
    });
    const { result } = renderHook(() => useDiscoveryPointers({ files, relayDestination: "wss://relay.example/", blossomDestination: "https://blossom.example", signer: testSigner }));

    await act(async () => result.current.start());

    expect(result.current.summaries.map((summary) => summary.status)).toEqual(["signing-failed", "published"]);
    expect([...publishes.values()].every((publish) => publish.mock.calls.length === 1)).toBe(true);
  });

  it("keeps one relay connection failure local to that relay", async () => {
    const testSigner = signer();
    vi.mocked(openDestinationRelay).mockImplementation(({ destination }) => {
      if (destination === "wss://relay.damus.io/") throw new DOMException("The port is blocked", "SecurityError");
      const publish = vi.fn().mockResolvedValue({ status: "accepted" });
      const close = vi.fn().mockResolvedValue(undefined);
      publishes.set(destination, publish);
      closes.set(destination, close);
      return { publish, close };
    });
    const { result } = renderHook(() => useDiscoveryPointers({ files, relayDestination: "wss://relay.example/", blossomDestination: "https://blossom.example", signer: testSigner }));

    await act(async () => result.current.start());

    expect(result.current.summaries.every((summary) => summary.status === "published")).toBe(true);
    expect(result.current.results.filter((item) => item.status === "publish-failed")).toHaveLength(2);
    expect(closes.size).toBe(4);
  });

  it("keeps a late relay failure from discarding the other relays' results", async () => {
    const testSigner = signer();
    vi.mocked(openDestinationRelay).mockImplementation(({ destination }) => {
      const publish = vi.fn().mockResolvedValue({ status: "accepted" });
      const close = destination === "wss://relay.damus.io/"
        ? vi.fn().mockRejectedValue(new Error("The socket closed unexpectedly"))
        : vi.fn().mockResolvedValue(undefined);
      publishes.set(destination, publish);
      closes.set(destination, close);
      return { publish, close };
    });
    const { result } = renderHook(() => useDiscoveryPointers({ files, relayDestination: "wss://relay.example/", blossomDestination: "https://blossom.example", signer: testSigner }));

    await act(async () => result.current.start());

    expect(result.current.state).toBe("complete");
    expect(result.current.summaries.every((summary) => summary.status === "published")).toBe(true);
    expect(result.current.results.filter((item) => item.status === "publish-failed")).toHaveLength(0);
    expect(result.current.results.filter((item) => "relay" in item && item.relay === "wss://relay.damus.io/")).toHaveLength(2);
  });

  it("reports future-dated pointers without signing or opening relays", async () => {
    vi.spyOn(Date, "now").mockReturnValue(20_000);
    const futureFiles = buildArchiveFiles({
      events: [makeFixtureEvent({ kind: 10_002, created_at: 21 }), makeFixtureEvent({ id: "2".repeat(64), kind: 10_063, created_at: 21 })],
      pubkey: fixturePubkey,
      sourceEndpoint: "https://api.divine.video",
      pageCount: 1,
      failures: [],
    });
    const testSigner = signer();
    const { result } = renderHook(() => useDiscoveryPointers({ files: futureFiles, relayDestination: "wss://relay.example/", blossomDestination: "https://blossom.example", signer: testSigner }));

    await act(async () => result.current.start());

    expect(result.current.summaries.map((summary) => summary.status)).toEqual(["blocked", "blocked"]);
    expect(testSigner.signEvent).not.toHaveBeenCalled();
    expect(openDestinationRelay).not.toHaveBeenCalled();
  });

  it("closes every active relay session when publication is cancelled", async () => {
    const testSigner = signer();
    vi.mocked(openDestinationRelay).mockImplementation(({ destination, signal }) => {
      const close = vi.fn().mockResolvedValue(undefined);
      closes.set(destination, close);
      return {
        publish: () => new Promise((_resolve, reject) => signal?.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true })),
        close,
      };
    });
    const { result, unmount } = renderHook(() => useDiscoveryPointers({ files, relayDestination: "wss://relay.example/", blossomDestination: "https://blossom.example", signer: testSigner }));
    let startPromise: Promise<void> | undefined;
    act(() => { startPromise = result.current.start(); });
    await vi.waitFor(() => expect(openDestinationRelay).toHaveBeenCalledTimes(5));

    unmount();

    await expect(startPromise).resolves.toBeUndefined();
    expect([...closes.values()].every((close) => close.mock.calls.length === 1)).toBe(true);
  });
});
