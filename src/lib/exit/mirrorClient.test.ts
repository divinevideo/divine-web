import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NostrSigner } from "@nostrify/nostrify";

import type { MediaReference } from "./archive";
import { DestinationError } from "./destination";
import { mirrorArchiveMedia, summarizeMirrorResults } from "./mirrorClient";

const hash = "a".repeat(64);
const otherHash = "b".repeat(64);
const thirdHash = "c".repeat(64);
const signer = {
  signEvent: vi.fn(async (event) => ({ ...event, id: "c".repeat(64), pubkey: "d".repeat(64), sig: "e".repeat(128) })),
} as unknown as NostrSigner;

function reference(url: string, sha256: string | null = hash): MediaReference {
  return { event_id: "f".repeat(64), tag: "url", url, sha256 };
}

function profileReference(url: string): MediaReference {
  return { ...reference(url, null), tag: "picture" };
}

function descriptor(sha256 = hash, size = 5) {
  return { url: `https://blossom.example/${sha256}`, sha256, size, type: "video/mp4" };
}

function blobHead(size = 5, contentType = "video/mp4") {
  return new Response(null, { status: 200, headers: { "content-length": String(size), "content-type": contentType } });
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
    expect(fetcher).toHaveBeenCalledTimes(2);
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

  it("uploads a hashless image with its computed hash", async () => {
    const imageHash = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("hello", { headers: { "content-type": "image/jpeg" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(descriptor(imageHash)), { status: 200 }))
      .mockResolvedValueOnce(blobHead(5, "image/jpeg"));
    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example", references: [profileReference("https://source.example/avatar.jpg")], signer, fetcher,
    });
    expect(results[0]).toMatchObject({
      verification: "upload-verified",
      expected_sha256: null,
      destination_sha256: imageHash,
      destination_url: `https://blossom.example/${imageHash}`,
    });
    expect(fetcher.mock.calls[1][0]).toBe("https://blossom.example/upload");
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "PUT", body: expect.any(Uint8Array) });
    expect(fetcher.mock.calls[2][1]).toMatchObject({ method: "HEAD", redirect: "follow" });
    expect(decodeAuthorization(new Headers(fetcher.mock.calls[1][1]?.headers).get("Authorization") ?? "").tags)
      .toContainEqual(["x", imageHash]);
  });

  it("does not rewrite to an uploaded descriptor URL that fails readback", async () => {
    const imageHash = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("hello", { headers: { "content-type": "image/jpeg" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(descriptor(imageHash)), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const [result] = await mirrorArchiveMedia({
      destination: "https://blossom.example", references: [profileReference("https://source.example/avatar.jpg")], signer, fetcher,
    });

    expect(result).toMatchObject({ verification: "unverified", destination_sha256: imageHash });
  });

  it("fails fast when the first hashless upload needs destination access", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("hello", { headers: { "content-type": "image/jpeg" } }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(mirrorArchiveMedia({
      destination: "https://blossom.example", references: [profileReference("https://source.example/avatar.jpg")], signer, fetcher,
    })).rejects.toMatchObject({ code: "auth-required" });
  });

  it("skips a hashless image when the destination has no upload support", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("hello", { headers: { "content-type": "image/jpeg" } }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example", references: [profileReference("https://source.example/avatar.jpg")], signer, fetcher,
    });
    expect(results[0]).toMatchObject({
      verification: "skipped",
      reason: expect.stringContaining("does not support browser uploads"),
    });
  });

  it("keeps the canary for a mirror after skipping unsupported browser uploads", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("hello", { headers: { "content-type": "image/jpeg" } }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(mirrorArchiveMedia({
      destination: "https://blossom.example",
      references: [profileReference("https://source.example/avatar.jpg"), reference("https://source.example/video.mp4")],
      signer,
      fetcher,
    })).rejects.toMatchObject({ code: "auth-required" });
  });

  it("does not certify a hashless upload whose descriptor reports another hash", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("hello", { headers: { "content-type": "image/jpeg" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(descriptor(otherHash)), { status: 200 }));
    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example", references: [profileReference("https://source.example/avatar.jpg")], signer, fetcher,
    });
    expect(results[0]).toMatchObject({ verification: "hash-mismatch", destination_sha256: otherHash });
  });

  it("skips hashless non-images and oversized images without uploading them", async () => {
    const nonImageFetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("hello", { headers: { "content-type": "video/mp4" } }));
    const [nonImage] = await mirrorArchiveMedia({
      destination: "https://blossom.example", references: [profileReference("https://source.example/video")], signer,
      fetcher: nonImageFetcher,
    });
    expect(nonImage).toMatchObject({ verification: "skipped", reason: expect.stringContaining("not a supported image") });
    expect(nonImageFetcher).toHaveBeenCalledOnce();

    const oversizedFetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("hello", {
        headers: { "content-type": "image/jpeg", "content-length": String(5 * 1024 * 1024 + 1) },
      }));
    const [oversized] = await mirrorArchiveMedia({
      destination: "https://blossom.example", references: [profileReference("https://source.example/avatar.jpg")], signer,
      fetcher: oversizedFetcher,
    });
    expect(oversized).toMatchObject({ verification: "skipped", reason: expect.stringContaining("larger than") });
    expect(oversizedFetcher).toHaveBeenCalledOnce();
  });

  it("leaves hashless non-profile images untouched", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const thumbnail = { ...reference("https://source.example/thumbnail.jpg", null), tag: "thumbnail" };

    const [result] = await mirrorArchiveMedia({
      destination: "https://blossom.example", references: [thumbnail], signer, fetcher,
    });

    expect(result).toMatchObject({
      verification: "skipped",
      reason: expect.stringContaining("did not advertise a SHA-256 hash"),
    });
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
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("not json", { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example",
      references: [reference("https://source.example/one")],
      signer,
      fetcher,
    });
    expect(results[0]).toMatchObject({ verification: "failed", reason: "The destination returned an invalid blob descriptor." });
  });

  it("reports a refused mirror as already present when the destination serves the blob", async () => {
    const source = `https://blossom.example/${hash}.jpg`;
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(blobHead());

    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example", references: [reference(source)], signer, fetcher,
    });

    expect(results[0]).toMatchObject({
      verification: "already-present",
      source_url: source,
      destination_url: source,
      destination_sha256: hash,
    });
    expect(fetcher.mock.calls[1]).toEqual([
      `https://blossom.example/${hash}`,
      expect.objectContaining({ method: "HEAD", redirect: "follow" }),
    ]);
  });

  it("uses the canonical destination URL when an existing blob came from another origin", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(blobHead());

    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example", references: [reference("https://source.example/one.jpg")], signer, fetcher,
    });

    expect(results[0]).toMatchObject({
      verification: "already-present",
      destination_url: `https://blossom.example/${hash}`,
    });
  });

  it("uses the canonical destination URL when a same-origin source names another blob", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(blobHead());

    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example",
      references: [reference(`https://blossom.example/${otherHash}.jpg`)],
      signer,
      fetcher,
    });

    expect(results[0]).toMatchObject({
      verification: "already-present",
      destination_url: `https://blossom.example/${hash}`,
    });
  });

  it("preserves a matching destination URL from anywhere in a hash group", async () => {
    const destinationSource = `https://blossom.example/${hash}.jpg`;
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(blobHead());

    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example",
      references: [reference("https://source.example/one.jpg"), reference(destinationSource)],
      signer,
      fetcher,
    });

    expect(results[0]).toMatchObject({
      verification: "already-present",
      destination_url: destinationSource,
    });
  });

  it("rejects a generic HTML catch-all as proof that the blob exists", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(blobHead(100, "text/html"));

    await expect(mirrorArchiveMedia({
      destination: "https://website.example",
      references: [reference("https://source.example/one")],
      signer,
      fetcher,
    })).rejects.toMatchObject({ code: "no-mirror-support" });
  });

  it("requires BUD-01 metadata before reporting a blob as already present", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example",
      references: [reference("https://source.example/one")],
      signer,
      fetcher,
    });

    expect(results[0].verification).toBe("failed");
  });

  it("keeps a refused mirror failed when the destination does not serve the blob", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example", references: [reference("https://source.example/one")], signer, fetcher,
    });

    expect(results[0].verification).toBe("failed");
  });

  it("does not fail the canary when a refused blob is already present", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(blobHead());

    await expect(mirrorArchiveMedia({
      destination: "https://blossom.example", references: [reference("https://source.example/one")], signer, fetcher,
    })).resolves.toMatchObject([{ verification: "already-present" }]);
  });

  it("keeps the canary for the first blob that is not already present", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(blobHead())
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(mirrorArchiveMedia({
      destination: "https://blossom.example",
      references: [reference("https://source.example/one"), reference("https://source.example/two", otherHash)],
      signer,
      fetcher,
    })).rejects.toMatchObject({ code: "auth-required" });
  });

  it("does not probe after a hash mismatch", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(descriptor(otherHash)), { status: 200 }));

    const results = await mirrorArchiveMedia({
      destination: "https://blossom.example", references: [reference("https://source.example/one")], signer, fetcher,
    });

    expect(results[0].verification).toBe("hash-mismatch");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("summarizes already-present blobs separately from mirrored and failed blobs", () => {
    expect(summarizeMirrorResults([
      { references: [], source_url: "one", destination_url: "one", expected_sha256: hash, destination_sha256: hash, byte_size: null, verification: "already-present" },
      { references: [], source_url: "two", destination_url: "two", expected_sha256: hash, destination_sha256: hash, byte_size: 5, verification: "descriptor-verified" },
      { references: [], source_url: "three", destination_url: null, expected_sha256: hash, destination_sha256: null, byte_size: null, verification: "failed" },
      { references: [], source_url: "four", destination_url: "four", expected_sha256: null, destination_sha256: hash, byte_size: 5, verification: "upload-verified" },
    ])).toEqual({ mirrored: 2, alreadyPresent: 1, failed: 1, skipped: 0, unverified: 0 });
  });

  it("throws a typed destination error after exhausted canary rate limits", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 429 }));
    await expect(mirrorArchiveMedia({
      destination: "https://blossom.example", references: [reference("https://source.example/one")], signer, fetcher,
      wait: async () => undefined, maxRateLimitRetries: 1,
    })).rejects.toBeInstanceOf(DestinationError);
  });
});
