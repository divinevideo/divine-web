import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaReference } from "./archive";
import { downloadArchiveMedia, isDivineMediaOrigin } from "./mediaDownloader";

const helloHash = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
const reference = (url: string, sha256: string | null = helloHash): MediaReference => ({
  event_id: "1111111111111111111111111111111111111111111111111111111111111111",
  tag: "url",
  url,
  sha256,
});

describe("downloadArchiveMedia", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("verifies bytes and writes them under their hash", async () => {
    const onFile = vi.fn(async () => undefined);
    const results = await downloadArchiveMedia({
      references: [reference("https://media.divine.video/blob")],
      fetcher: vi.fn(async () => new Response("hello", { headers: { "content-type": "video/mp4" } })),
      onFile,
    });
    expect(results[0]).toMatchObject({ verification: "verified", computed_sha256: helloHash, archive_path: `media/${helloHash}.mp4` });
    expect(onFile).toHaveBeenCalledWith(`media/${helloHash}.mp4`, expect.any(Uint8Array));
  });

  it("tries another source for the same hash after a mismatch", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => new Response(String(input).includes("bad") ? "wrong" : "hello"));
    const results = await downloadArchiveMedia({
      references: [reference("https://example.com/bad"), reference("https://example.com/good")],
      fetcher,
      onFile: async () => undefined,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(results[0]).toMatchObject({ verification: "verified", source_url: "https://example.com/good" });
    expect(results[0].references).toHaveLength(2);
  });

  it("downloads one blob for duplicate profile and tag references", async () => {
    const url = `https://media.divine.video/${helloHash}.jpg`;
    const fetcher = vi.fn(async () => new Response("hello", { headers: { "content-type": "image/jpeg" } }));
    const onFile = vi.fn(async () => undefined);

    const results = await downloadArchiveMedia({
      references: [reference(url), { ...reference(url), tag: "picture" }],
      fetcher,
      onFile,
    });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(onFile).toHaveBeenCalledOnce();
    expect(results[0].references).toHaveLength(2);
  });

  it("quarantines the last mismatch when every mirror is invalid", async () => {
    const onFile = vi.fn(async () => undefined);
    const results = await downloadArchiveMedia({
      references: [reference("https://example.com/wrong-one"), reference("https://example.com/wrong-two")],
      fetcher: vi.fn(async () => new Response("wrong")),
      onFile,
    });
    expect(results[0].verification).toBe("hash-mismatch");
    expect(onFile).toHaveBeenCalledWith(`media/mismatched/${helloHash}.bin`, expect.any(Uint8Array));
  });

  it("quarantines a mismatched file without certifying it", async () => {
    const onFile = vi.fn(async () => undefined);
    const results = await downloadArchiveMedia({
      references: [reference("https://example.com/wrong")],
      fetcher: vi.fn(async () => new Response("wrong", { headers: { "content-type": "image/jpeg" } })),
      onFile,
    });
    expect(results[0]).toMatchObject({ verification: "hash-mismatch", archive_path: `media/mismatched/${helloHash}.jpg` });
  });

  it("records HTTP, network, cancellation, and sink failures instead of throwing", async () => {
    const controller = new AbortController();
    controller.abort();
    const cases = [
      await downloadArchiveMedia({ references: [reference("https://example.com/404")], fetcher: vi.fn(async () => new Response(null, { status: 404 })), onFile: async () => undefined }),
      await downloadArchiveMedia({ references: [reference("https://example.com/network")], fetcher: vi.fn(async () => { throw new TypeError("offline"); }), onFile: async () => undefined }),
      await downloadArchiveMedia({ references: [reference("https://example.com/cancel")], signal: controller.signal, fetcher: vi.fn(), onFile: async () => undefined }),
      await downloadArchiveMedia({ references: [reference("https://example.com/write")], fetcher: vi.fn(async () => new Response("hello")), onFile: async () => { throw new Error("disk full"); } }),
    ];
    for (const [result] of cases) expect(result.verification).toBe("failed");
  });

  it("rejects truncated responses and follows redirects for bare requests", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("short", { headers: { "content-length": "99" } }));
    const [result] = await downloadArchiveMedia({
      references: [reference("https://example.com/truncated")], fetcher, onFile: async () => undefined,
    });
    expect(result).toMatchObject({ verification: "failed" });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "follow" });
  });

  it("accepts a redirected bare candidate when the final bytes match", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init).toMatchObject({ redirect: "follow" });
      return new Response("hello", { headers: { "content-type": "video/mp4" } });
    });
    const [result] = await downloadArchiveMedia({
      references: [reference("https://blossom.example/redirecting-blob")], fetcher, onFile: async () => undefined,
    });

    expect(result.verification).toBe("verified");
  });

  it("retries an auth challenge only for the exact Divine media origin", async () => {
    const divineFetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response("hello"));
    const signer = { getPublicKey: vi.fn(), signEvent: vi.fn(async (event) => ({ ...event, id: "a".repeat(64), pubkey: "b".repeat(64), sig: "c".repeat(128) })) };
    await downloadArchiveMedia({ references: [reference("https://media.divine.video/blob")], signer, fetcher: divineFetch, onFile: async () => undefined });
    expect(divineFetch).toHaveBeenCalledTimes(2);
    expect(divineFetch.mock.calls[0][1]).toMatchObject({ redirect: "follow" });
    expect(divineFetch.mock.calls[1][1]).toMatchObject({ redirect: "error" });
    expect((divineFetch.mock.calls[1][1]?.headers as Record<string, string>).Authorization).toMatch(/^Nostr /);

    const thirdPartyFetch = vi.fn(async () => new Response(null, { status: 401 }));
    await downloadArchiveMedia({ references: [reference("https://media.divine.video.evil.example/blob")], signer, fetcher: thirdPartyFetch, onFile: async () => undefined });
    expect(thirdPartyFetch).toHaveBeenCalledOnce();
  });

  it("rejects an authorized response that resolves off the Divine media origin", async () => {
    const redirectedResponse = new Response("hello");
    Object.defineProperty(redirectedResponse, "url", { value: "https://cdn.example/blob" });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(redirectedResponse);
    const signer = { getPublicKey: vi.fn(), signEvent: vi.fn(async (event) => ({ ...event, id: "a".repeat(64), pubkey: "b".repeat(64), sig: "c".repeat(128) })) };

    const [result] = await downloadArchiveMedia({
      references: [reference("https://media.divine.video/blob")], signer, fetcher, onFile: async () => undefined,
    });

    expect(result).toMatchObject({ verification: "failed" });
    expect(result.failure_reason).toContain("redirected to an untrusted origin");
  });
});

describe("isDivineMediaOrigin", () => {
  it("requires the exact HTTPS origin", () => {
    expect(isDivineMediaOrigin("https://media.divine.video/blob")).toBe(true);
    expect(isDivineMediaOrigin("http://media.divine.video/blob")).toBe(false);
    expect(isDivineMediaOrigin("https://media.divine.video.evil.example/blob")).toBe(false);
  });
});
