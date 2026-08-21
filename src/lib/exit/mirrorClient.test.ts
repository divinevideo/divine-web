import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NostrSigner } from "@nostrify/nostrify";

import type { MediaReference } from "./archive";
import { DestinationError } from "./destination";
import { mirrorArchiveMedia } from "./mirrorClient";

const hash = "a".repeat(64);
const otherHash = "b".repeat(64);
const thirdHash = "c".repeat(64);
const signer = {
  signEvent: vi.fn(async (event) => ({ ...event, id: "c".repeat(64), pubkey: "d".repeat(64), sig: "e".repeat(128) })),
} as unknown as NostrSigner;

function reference(url: string, sha256: string | null = hash): MediaReference {
  return { event_id: "f".repeat(64), tag: "url", url, sha256 };
}

function descriptor(sha256 = hash, size = 5) {
  return { url: `https://blossom.example/${sha256}`, sha256, size, type: "video/mp4" };
}

function decodeAuthorization(value: string): { tags: string[][] } {
  const token = value.slice("Nostr ".length);
  const padded = token.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(token.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

describe("mirrorArchiveMedia", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the first real mirror as a canary without mirroring it twice", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(descriptor()), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-length": "5" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(descriptor(otherHash)), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-length": "5" } }));

    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example",
      references: [reference("https://source.example/one"), reference("https://source.example/two", otherHash)],
      signer,
      fetcher,
    });

    expect(results).toHaveLength(2);
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(2);
    expect(results[0].verification).toBe("descriptor-verified");
  });

  it.each([
    [401, "auth-required"],
    [403, "auth-required"],
    [404, "no-mirror-support"],
    [405, "no-mirror-support"],
    [501, "no-mirror-support"],
  ])("fails fast when the canary returns %s", async (status, code) => {
    const fetcher = vi.fn(async () => new Response(null, { status }));
    await expect(mirrorArchiveMedia({
      destination: "https://blossom.example",
      references: [reference("https://source.example/one"), reference("https://source.example/two", otherHash)],
      signer,
      fetcher,
    })).rejects.toMatchObject({ code });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("describes a canary CORS or network failure honestly", async () => {
    const fetcher = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    await expect(mirrorArchiveMedia({
      destination: "https://blossom.example",
      references: [reference("https://source.example/one")], signer, fetcher,
    })).rejects.toMatchObject({
      code: "unreachable",
      message: expect.stringContaining("may be down, or it may not accept requests from other websites"),
    });
  });

  it("honors Retry-After before retrying a rate limit", async () => {
    const wait = vi.fn(async () => undefined);
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(descriptor()), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-length": "5" } }));
    await mirrorArchiveMedia({ destination: "https://blossom.example", references: [reference("https://source.example/one")], signer, fetcher, wait });
    expect(wait).toHaveBeenCalledWith(2000, undefined);
  });

  it("rejects a mismatched descriptor and continues after later file failures", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(descriptor(otherHash)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(descriptor(thirdHash)), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-length": "9" } }));
    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example",
      references: [reference("https://source.example/one"), reference("https://source.example/two", thirdHash)],
      signer,
      fetcher,
    });
    expect(results[0].verification).toBe("hash-mismatch");
    expect(results[1].verification).toBe("unverified");
  });

  it("skips HLS manifests and reports their progress in source order", async () => {
    const onProgress = vi.fn();
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(descriptor()), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-length": "5" } }));
    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example",
      references: [reference("https://source.example/master.m3u8", null), reference("https://source.example/video", hash)],
      signer,
      fetcher,
      onProgress,
    });
    expect(results).toMatchObject([
      { verification: "skipped" },
      { verification: "descriptor-verified" },
    ]);
    expect(onProgress.mock.calls.map(([progress]) => progress.completed)).toEqual([1, 2]);
  });

  it("skips a source without an advertised hash before signing or requesting it", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example", references: [reference("https://source.example/no-hash", null)], signer, fetcher,
    });
    expect(results[0]).toMatchObject({
      verification: "skipped",
      destination_sha256: null,
      reason: expect.stringContaining("did not advertise a SHA-256 hash"),
    });
    expect(signer.signEvent).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends a BUD-11-compliant authorization token to a strict destination", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "HEAD") {
        return new Response(null, { status: 200, headers: { "content-length": "5" } });
      }
      const authorization = new Headers(init?.headers).get("Authorization") ?? "";
      const token = authorization.slice("Nostr ".length);
      if (!authorization.startsWith("Nostr ") || /[+/=]/.test(token)) return new Response(null, { status: 401 });
      const event = decodeAuthorization(authorization);
      if (!event.tags.some((tag) => tag[0] === "x" && tag[1] === hash)) return new Response(null, { status: 401 });
      return new Response(JSON.stringify(descriptor()), { status: 200 });
    });

    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example",
      references: [reference("https://source.example/video")],
      signer,
      fetcher,
    });

    expect(results[0].verification).toBe("descriptor-verified");
  });

  it("allows destination readback to follow redirects", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(descriptor()), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-length": "5" } }));

    await mirrorArchiveMedia({
      destination: "https://blossom.example",
      references: [reference("https://source.example/video")],
      signer,
      fetcher,
    });

    expect(fetcher.mock.calls[1][1]).not.toMatchObject({ redirect: "error" });
  });

  it("follows a BUD-01 redirect when reading the mirrored blob back", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(descriptor()), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-length": "5" } }));
    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example", references: [reference("https://source.example/one")], signer, fetcher,
    });

    expect(results[0].verification).toBe("descriptor-verified");
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "HEAD", redirect: "follow" });
  });

  it("passes the destination's own X-Reason on to the person reading the summary", async () => {
    const fetcher = vi.fn(async () => new Response(null, {
      status: 413,
      headers: { "x-reason": "  Blob exceeds the 100 MB   limit for this account  " },
    }));
    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example",
      references: [reference("https://source.example/one"), reference("https://source.example/two", otherHash)],
      signer,
      fetcher,
    });

    expect(results[0]).toMatchObject({
      verification: "failed",
      reason: "The destination refused this file (HTTP 413). The server said: Blob exceeds the 100 MB limit for this account",
    });
  });

  it("records malformed destination JSON as a file failure", async () => {
    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example",
      references: [reference("https://source.example/one")],
      signer,
      fetcher: vi.fn(async () => new Response("not json", { status: 200 })),
    });
    expect(results[0]).toMatchObject({ verification: "failed", reason: "The destination returned an invalid blob descriptor." });
  });

  it("throws a typed destination error after exhausted canary rate limits", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 429 }));
    await expect(mirrorArchiveMedia({
      destination: "https://blossom.example", references: [reference("https://source.example/one")], signer, fetcher,
      wait: async () => undefined, maxRateLimitRetries: 1,
    })).rejects.toBeInstanceOf(DestinationError);
  });
});
