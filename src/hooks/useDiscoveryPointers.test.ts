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
    vi.mocked(openDestinationRelay).mockReturnValue({ publish, close });
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
});
