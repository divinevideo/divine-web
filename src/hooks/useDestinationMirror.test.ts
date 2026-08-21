import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fixturePubkey, makeFixtureEvent, otherFixturePubkey } from "@/lib/exit/__fixtures__/exportFixtures";
import { FixtureSigner } from "@/lib/exit/__fixtures__/fixtureSigner";
import { buildArchiveFiles } from "@/lib/exit/archive";

import { useDestinationMirror } from "./useDestinationMirror";

function files(pubkey: string) {
  return buildArchiveFiles({
    events: [makeFixtureEvent({ pubkey })],
    pubkey,
    sourceEndpoint: "https://api.divine.video",
    pageCount: 1,
    failures: [],
  });
}

const signer = new FixtureSigner();

describe("useDestinationMirror", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports an unusable destination URL instead of rejecting the caller", async () => {
    const { result } = renderHook(() => useDestinationMirror({ files: files(fixturePubkey), signer }));

    await act(async () => {
      await result.current.start("https://blossom.example/path");
    });

    expect(result.current.state).toBe("failed");
    expect(result.current.destination).toBeNull();
    expect(result.current.failure).toBe(
      "Blossom servers answer at the domain root. Use https://blossom.example instead.",
    );
  });

  it("aborts active work and clears its state when the account changes", async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Mirror cancelled", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", fetcher);
    const { result, rerender } = renderHook(
      ({ archive }) => useDestinationMirror({ files: archive, signer }),
      { initialProps: { archive: files(fixturePubkey) } },
    );

    let startPromise: Promise<void> | undefined;
    act(() => {
      startPromise = result.current.start("https://blossom.example");
    });
    await waitFor(() => expect(result.current.state).toBe("running"));
    rerender({ archive: files(otherFixturePubkey) });
    await waitFor(() => expect(result.current.state).toBe("idle"));
    await startPromise;

    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(result.current.summary).toBeNull();
    expect(result.current.results).toBeNull();
    expect(result.current.failure).toBeNull();
    expect(result.current.destination).toBeNull();
  });
});
