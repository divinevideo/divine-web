import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fixturePubkey, makeFixtureEvent, otherFixturePubkey } from "@/lib/exit/__fixtures__/exportFixtures";
import { FixtureSigner } from "@/lib/exit/__fixtures__/fixtureSigner";
import { buildArchiveFiles } from "@/lib/exit/archive";
import { publishArchiveEvents } from "@/lib/exit/relayPublisher";
import { fetchRelayAgeLimit } from "@/lib/exit/relayLimits";

import { useDestinationRepublish } from "./useDestinationRepublish";

vi.mock("@/lib/exit/relayPublisher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exit/relayPublisher")>();
  return { ...actual, publishArchiveEvents: vi.fn() };
});
vi.mock("@/lib/exit/relayLimits", () => ({ fetchRelayAgeLimit: vi.fn() }));

function files(pubkey: string) {
  return buildArchiveFiles({ events: [makeFixtureEvent({ pubkey })], pubkey, sourceEndpoint: "https://api.divine.video", pageCount: 1, failures: [] });
}

const signer = new FixtureSigner();
const mirrorResults = [];

describe("useDestinationRepublish", () => {
  beforeEach(() => {
    vi.mocked(publishArchiveEvents).mockReset();
    vi.mocked(fetchRelayAgeLimit).mockReset().mockResolvedValue(null);
  });

  it("completes with a publish summary", async () => {
    vi.mocked(publishArchiveEvents).mockResolvedValue([
      { event_id: "1".repeat(64), published_event_id: "1".repeat(64), kind: 1, status: "unchanged", remaining_media_urls: 0, redated: false },
    ]);
    const { result } = renderHook(() => useDestinationRepublish({ files: files(fixturePubkey), mirrorResults, signer }));
    await act(async () => result.current.start("wss://relay.example"));
    expect(result.current.state).toBe("complete");
    expect(result.current.summary).toMatchObject({ published: 0, unchanged: 1, skipped: 0, failed: 0 });
    expect(result.current.destination).toBe("wss://relay.example/");
    expect(fetchRelayAgeLimit).toHaveBeenCalledWith("wss://relay.example/", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("aborts and resets when the account changes", async () => {
    let publishSignal: AbortSignal | undefined;
    vi.mocked(publishArchiveEvents).mockImplementation((options) => new Promise((resolve) => {
      if (!options) {
        resolve([]);
        return;
      }
      publishSignal = options.signal;
      options.signal?.addEventListener("abort", () => resolve([]), { once: true });
    }));
    const { result, rerender } = renderHook(
      ({ archive }) => useDestinationRepublish({ files: archive, mirrorResults, signer }),
      { initialProps: { archive: files(fixturePubkey) } },
    );
    act(() => { void result.current.start("wss://relay.example"); });
    await waitFor(() => expect(result.current.state).toBe("running"));
    rerender({ archive: files(otherFixturePubkey) });
    await waitFor(() => expect(result.current.state).toBe("idle"));
    expect(publishSignal?.aborted).toBe(true);
    expect(result.current.results).toBeNull();
    expect(result.current.destination).toBeNull();
  });
});
