import type { NostrEvent, NostrSigner } from "@nostrify/nostrify";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildArchiveFiles } from "@/lib/exit/archive";
import { fixturePubkey, makeFixtureEvent } from "@/lib/exit/__fixtures__/exportFixtures";
import { openDestinationRelay } from "@/lib/exit/relayConnection";

import { useDiscoveryPointers } from "./useDiscoveryPointers";

vi.mock("@/lib/exit/relayConnection", () => ({ openDestinationRelay: vi.fn() }));

const files = buildArchiveFiles({ events: [makeFixtureEvent()], pubkey: fixturePubkey, sourceEndpoint: "https://api.divine.video", pageCount: 1, failures: [] });

function signer(sign: (template: Omit<NostrEvent, "id" | "pubkey" | "sig">) => Promise<NostrEvent>): NostrSigner {
  return { signEvent: vi.fn(sign) } as unknown as NostrSigner;
}

describe("useDiscoveryPointers", () => {
  const publish = vi.fn();
  const close = vi.fn();

  beforeEach(() => {
    publish.mockReset().mockResolvedValue({ status: "accepted" });
    close.mockReset().mockResolvedValue(undefined);
    vi.mocked(openDestinationRelay).mockReset().mockReturnValue({ publish, close });
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
    expect(result.current.results.map((item) => item.status)).toEqual(["signing-failed", "published"]);
    expect(publish).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("reports relay failures independently", async () => {
    const testSigner = signer(async (template) => ({ ...template, id: "a".repeat(64), pubkey: fixturePubkey, sig: "b".repeat(128) }));
    publish.mockResolvedValueOnce({ status: "failed", code: "blocked", message: "blocked" }).mockResolvedValueOnce({ status: "accepted" });
    const { result } = renderHook(() => useDiscoveryPointers({ files, relayDestination: "wss://relay.example/", blossomDestination: "https://blossom.example", signer: testSigner }));
    await act(async () => result.current.start());
    expect(result.current.results.map((item) => item.status)).toEqual(["publish-failed", "published"]);
  });

  it("rejects a signed pointer for another account", async () => {
    const testSigner = signer(async (template) => ({ ...template, id: "a".repeat(64), pubkey: "d".repeat(64), sig: "b".repeat(128) }));
    const { result } = renderHook(() => useDiscoveryPointers({ files, relayDestination: "wss://relay.example/", blossomDestination: "https://blossom.example", signer: testSigner }));
    await act(async () => result.current.start());
    expect(result.current.results.every((item) => item.status === "signing-failed")).toBe(true);
    expect(publish).not.toHaveBeenCalled();
  });

  it("reports future-dated pointers without opening a relay connection", async () => {
    vi.spyOn(Date, "now").mockReturnValue(20_000);
    const futureFiles = buildArchiveFiles({
      events: [
        makeFixtureEvent({ kind: 10_002, created_at: 21 }),
        makeFixtureEvent({ id: "2".repeat(64), kind: 10_063, created_at: 21 }),
      ],
      pubkey: fixturePubkey,
      sourceEndpoint: "https://api.divine.video",
      pageCount: 1,
      failures: [],
    });
    const testSigner = signer(async (template) => ({ ...template, id: "a".repeat(64), pubkey: fixturePubkey, sig: "b".repeat(128) }));
    const { result } = renderHook(() => useDiscoveryPointers({ files: futureFiles, relayDestination: "wss://relay.example/", blossomDestination: "https://blossom.example", signer: testSigner }));

    await act(async () => result.current.start());

    expect(result.current.results.map((item) => item.status)).toEqual(["blocked", "blocked"]);
    expect(testSigner.signEvent).not.toHaveBeenCalled();
    expect(openDestinationRelay).not.toHaveBeenCalled();
  });

  it("resolves cleanly when an active publication is cancelled", async () => {
    const testSigner = signer(async (template) => ({ ...template, id: "a".repeat(64), pubkey: fixturePubkey, sig: "b".repeat(128) }));
    vi.mocked(openDestinationRelay).mockImplementation((options) => ({
      publish: () => new Promise((_resolve, reject) => {
        if (options.signal?.aborted) {
          reject(new DOMException("Relay publish cancelled", "AbortError"));
          return;
        }
        options.signal?.addEventListener("abort", () => reject(new DOMException("Relay publish cancelled", "AbortError")), { once: true });
      }),
      close,
    }));
    const { result, unmount } = renderHook(() => useDiscoveryPointers({ files, relayDestination: "wss://relay.example/", blossomDestination: "https://blossom.example", signer: testSigner }));
    let startPromise: Promise<void> | undefined;
    act(() => { startPromise = result.current.start(); });

    unmount();

    await expect(startPromise).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledOnce();
  });

  it("reports a relay connection that cannot start", async () => {
    const testSigner = signer(async (template) => ({ ...template, id: "a".repeat(64), pubkey: fixturePubkey, sig: "b".repeat(128) }));
    vi.mocked(openDestinationRelay).mockImplementation(() => {
      throw new DOMException("The port is blocked", "SecurityError");
    });
    const { result } = renderHook(() => useDiscoveryPointers({ files, relayDestination: "wss://relay.example/", blossomDestination: "https://blossom.example", signer: testSigner }));

    await act(async () => result.current.start());

    expect(result.current.state).toBe("complete");
    expect(result.current.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "publish-failed", reason: expect.stringContaining("could not start") }),
    ]));
    expect(testSigner.signEvent).not.toHaveBeenCalled();
  });
});
