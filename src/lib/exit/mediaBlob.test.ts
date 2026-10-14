import { describe, expect, it, vi } from "vitest";

import { fetchAndHashBlob, isDivineMediaOrigin } from "./mediaBlob";

const helloHash = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

describe("fetchAndHashBlob", () => {
  it("returns bounded bytes and their SHA-256", async () => {
    const result = await fetchAndHashBlob({
      url: "https://example.com/avatar.jpg",
      fetcher: vi.fn(async () => new Response("hello", {
        headers: { "content-type": "image/jpeg", "content-length": "5" },
      })),
      maxBytes: 5,
    });

    expect(result).toMatchObject({ computedSha256: helloHash, contentType: "image/jpeg" });
    expect(result.bytes).toEqual(new TextEncoder().encode("hello"));
  });

  it("rejects advertised and streamed bodies over the limit", async () => {
    await expect(fetchAndHashBlob({
      url: "https://example.com/large.jpg",
      fetcher: vi.fn(async () => new Response("hello", { headers: { "content-length": "6" } })),
      maxBytes: 5,
    })).rejects.toThrow("larger than 5 bytes");

    await expect(fetchAndHashBlob({
      url: "https://example.com/large.jpg",
      fetcher: vi.fn(async () => new Response("hello!")),
      maxBytes: 5,
    })).rejects.toThrow("larger than 5 bytes");
  });

  it("sends viewer authorization only to the exact Divine media origin", async () => {
    const signer = {
      getPublicKey: vi.fn(),
      signEvent: vi.fn(async (event) => ({ ...event, id: "a".repeat(64), pubkey: "b".repeat(64), sig: "c".repeat(128) })),
    };
    const divineFetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response("hello"));

    await fetchAndHashBlob({ url: "https://media.divine.video/blob", signer, fetcher: divineFetch });
    expect(divineFetch).toHaveBeenCalledTimes(2);
    expect(divineFetch.mock.calls[1][1]).toMatchObject({ redirect: "error" });
    expect(new Headers(divineFetch.mock.calls[1][1]?.headers).get("Authorization")).toMatch(/^Nostr /);

    const thirdPartyFetch = vi.fn(async () => new Response(null, { status: 401 }));
    await expect(fetchAndHashBlob({
      url: "https://media.divine.video.evil.example/blob", signer, fetcher: thirdPartyFetch,
    })).rejects.toThrow("HTTP 401");
    expect(thirdPartyFetch).toHaveBeenCalledOnce();
  });

  it("rejects an authorized response that resolves off the Divine media origin", async () => {
    const redirected = new Response("hello");
    Object.defineProperty(redirected, "url", { value: "https://cdn.example/blob" });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(redirected);
    const signer = {
      getPublicKey: vi.fn(),
      signEvent: vi.fn(async (event) => ({ ...event, id: "a".repeat(64), pubkey: "b".repeat(64), sig: "c".repeat(128) })),
    };

    await expect(fetchAndHashBlob({
      url: "https://media.divine.video/blob", signer, fetcher,
    })).rejects.toThrow("redirected to an untrusted origin");
  });
});

describe("isDivineMediaOrigin", () => {
  it("requires the exact HTTPS origin", () => {
    expect(isDivineMediaOrigin("https://media.divine.video/blob")).toBe(true);
    expect(isDivineMediaOrigin("http://media.divine.video/blob")).toBe(false);
    expect(isDivineMediaOrigin("https://media.divine.video.evil.example/blob")).toBe(false);
  });
});
