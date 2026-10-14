import { describe, expect, it, vi } from "vitest";

import { fetchRelayAgeLimit } from "./relayLimits";

const RELAY = "wss://relay.example/nostr";

describe("fetchRelayAgeLimit", () => {
  it("reads a declared positive created-at age limit", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      limitation: { created_at_lower_limit: 94_608_000 },
    }), { status: 200 }));

    await expect(fetchRelayAgeLimit(RELAY, { fetcher })).resolves.toBe(94_608_000);
    expect(fetcher).toHaveBeenCalledWith("https://relay.example/nostr", expect.objectContaining({
      headers: { Accept: "application/nostr+json" },
    }));
  });

  it.each([
    ["an absent limit", {}],
    ["a negative limit", { limitation: { created_at_lower_limit: -1 } }],
    ["a non-numeric limit", { limitation: { created_at_lower_limit: "94608000" } }],
  ])("treats %s as undeclared", async (_label, document) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(document), { status: 200 }));
    await expect(fetchRelayAgeLimit(RELAY, { fetcher })).resolves.toBeNull();
  });

  it("reads a zero limit as no lower age bound", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      limitation: { created_at_lower_limit: 0 },
    }), { status: 200 }));

    await expect(fetchRelayAgeLimit(RELAY, { fetcher })).resolves.toBe(0);
  });

  it("treats an unavailable document as undeclared", async () => {
    const failedResponse = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    const failedRequest = vi.fn().mockRejectedValue(new TypeError("offline"));

    await expect(fetchRelayAgeLimit(RELAY, { fetcher: failedResponse })).resolves.toBeNull();
    await expect(fetchRelayAgeLimit(RELAY, { fetcher: failedRequest })).resolves.toBeNull();
  });

  it("preserves cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"));

    await expect(fetchRelayAgeLimit(RELAY, { fetcher, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("treats a timed-out document as undeclared", async () => {
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));

    await expect(fetchRelayAgeLimit(RELAY, { fetcher: fetcher as typeof fetch, timeoutMs: 1 })).resolves.toBeNull();
  });
});
