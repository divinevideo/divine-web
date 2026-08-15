import { describe, expect, it } from "vitest";

import { fixturePubkey, makeFixtureEvent } from "./__fixtures__/exportFixtures";
import { createFixtureFetch } from "./__fixtures__/fixtureFetch";
import { FixtureSigner } from "./__fixtures__/fixtureSigner";
import { exportOwnerEvents, OwnerExportError } from "./ownerExportClient";

describe("exportOwnerEvents", () => {
  it("walks opaque cursors until the export is complete", async () => {
    const signer = new FixtureSigner();
    const progress: Array<{ pagesFetched: number; eventsFetched: number; retryCount: number }> = [];

    const result = await exportOwnerEvents({
      endpointBase: "https://api.divine.video",
      pubkey: fixturePubkey,
      signer,
      fetcher: createFixtureFetch("multi-page"),
      onProgress: (value) => progress.push(value)
    });

    expect(result.pageCount).toBe(2);
    expect(result.events).toHaveLength(2);
    expect(result.events.map((event) => event.id)).toEqual([
      "1111111111111111111111111111111111111111111111111111111111111111",
      "2222222222222222222222222222222222222222222222222222222222222222"
    ]);
    expect(progress).toEqual([
      { pagesFetched: 1, eventsFetched: 1, retryCount: 0 },
      { pagesFetched: 2, eventsFetched: 2, retryCount: 0 }
    ]);
    expect(signer.signedUrls[1]).toContain("cursor=550e8400-e29b-41d4-a716-446655440000");
  });

  it("backs off on 429, keeps the same page, and re-signs the request", async () => {
    const signer = new FixtureSigner();
    const sleeps: number[] = [];

    const result = await exportOwnerEvents({
      endpointBase: "https://api.divine.video",
      pubkey: fixturePubkey,
      signer,
      fetcher: createFixtureFetch("rate-limit"),
      sleep: async (ms) => {
        sleeps.push(ms);
      }
    });

    expect(result.events).toHaveLength(1);
    expect(sleeps).toEqual([1000]);
    expect(signer.signedUrls).toHaveLength(2);
    expect(signer.signedUrls[0]).toBe(signer.signedUrls[1]);
  });

  it("never sleeps for zero milliseconds when Retry-After is zero", async () => {
    const sleeps: number[] = [];
    let requests = 0;

    await exportOwnerEvents({
      endpointBase: "https://api.divine.video",
      pubkey: fixturePubkey,
      signer: new FixtureSigner(),
      fetcher: async () => {
        requests += 1;
        if (requests <= 2) {
          return new Response(JSON.stringify({ error: "slow down" }), {
            status: 429,
            headers: { "retry-after": "0" }
          });
        }

        return new Response(
          JSON.stringify({
            data: [],
            pagination: { next_cursor: null, has_more: false }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      }
    });

    expect(sleeps.every((ms) => ms >= 1000)).toBe(true);
  });

  it("reports auth-required when the request cannot be signed", async () => {
    const brokenSigner = {
      getPublicKey: async () => fixturePubkey,
      signEvent: async () => {
        throw new Error("signer unavailable");
      }
    };

    await expect(
      exportOwnerEvents({
        endpointBase: "https://api.divine.video",
        pubkey: fixturePubkey,
        signer: brokenSigner,
        fetcher: createFixtureFetch("one-page")
      })
    ).rejects.toMatchObject({ code: "auth-required" });
  });

  it.each([
    ["bad-cursor", "bad-cursor"],
    ["expired-cursor", "expired-cursor"],
    ["auth-failure", "auth-required"],
    ["pubkey-mismatch", "pubkey-mismatch"],
    ["network-failure", "network-failure"],
    ["server-failure", "server-failure"]
  ] as const)("maps %s to a distinct error state", async (scenario, code) => {
    await expect(
      exportOwnerEvents({
        endpointBase: "https://api.divine.video",
        pubkey: fixturePubkey,
        signer: new FixtureSigner(),
        fetcher: createFixtureFetch(scenario)
      })
    ).rejects.toMatchObject({ code });
  });

  it("surfaces rate limit failure copy when retries are exhausted", async () => {
    await expect(
      exportOwnerEvents({
        endpointBase: "https://api.divine.video",
        pubkey: fixturePubkey,
        signer: new FixtureSigner(),
        fetcher: createFixtureFetch("always-rate-limit"),
        sleep: async () => undefined,
        maxRateLimitRetries: 1
      })
    ).rejects.toMatchObject({
      code: "rate-limited",
      message: "Divine asked this export to slow down. Wait a moment and try again."
    });
  });

  it("rejects malformed JSON envelopes", async () => {
    await expect(
      exportOwnerEvents({
        endpointBase: "https://api.divine.video",
        pubkey: fixturePubkey,
        signer: new FixtureSigner(),
        fetcher: async () => new Response(JSON.stringify({ data: [] }), { status: 200 })
      })
    ).rejects.toMatchObject({ code: "malformed-response" });
  });

  it("backs off exponentially when Retry-After is absent", async () => {
    const sleeps: number[] = [];
    let requests = 0;

    await expect(
      exportOwnerEvents({
        endpointBase: "https://api.divine.video",
        pubkey: fixturePubkey,
        signer: new FixtureSigner(),
        fetcher: async () => {
          requests += 1;
          return new Response(JSON.stringify({ error: "slow down" }), { status: 429 });
        },
        sleep: async (ms) => {
          sleeps.push(ms);
        },
        maxRateLimitRetries: 2
      })
    ).rejects.toMatchObject({ code: "rate-limited" });

    expect(requests).toBe(3);
    expect(sleeps).toEqual([1000, 2000]);
  });

  it("rejects truncated event identifiers", async () => {
    await expect(
      exportOwnerEvents({
        endpointBase: "https://api.divine.video",
        pubkey: fixturePubkey,
        signer: new FixtureSigner(),
        fetcher: async () =>
          new Response(
            JSON.stringify({
              data: [
                {
                  id: "1111",
                  pubkey: fixturePubkey,
                  created_at: 1,
                  kind: 1,
                  tags: [],
                  content: "",
                  sig: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
                }
              ],
              pagination: { next_cursor: null, has_more: false }
            }),
            { status: 200 }
          )
      })
    ).rejects.toMatchObject({ code: "malformed-response" });
  });

  it("keeps the events it collected when the export fails partway", async () => {
    let requests = 0;

    const result = await exportOwnerEvents({
      endpointBase: "https://api.divine.video",
      pubkey: fixturePubkey,
      signer: new FixtureSigner(),
      fetcher: async () => {
        requests += 1;
        if (requests === 1) {
          return new Response(
            JSON.stringify({
              data: [makeFixtureEvent()],
              pagination: { next_cursor: "cursor-one", has_more: true }
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        return new Response(JSON.stringify({ error: "boom" }), { status: 503 });
      }
    });

    expect(result.events).toHaveLength(1);
    expect(result.pageCount).toBe(1);
    expect(result.failures.map((failure) => failure.code)).toEqual(["server-failure"]);
  });

  it("still rejects when the export fails before anything was collected", async () => {
    await expect(
      exportOwnerEvents({
        endpointBase: "https://api.divine.video",
        pubkey: fixturePubkey,
        signer: new FixtureSigner(),
        fetcher: createFixtureFetch("server-failure")
      })
    ).rejects.toMatchObject({ code: "server-failure" });
  });

  it("stops and keeps what it has when the server stops advancing the cursor", async () => {
    let requests = 0;

    const result = await exportOwnerEvents({
      endpointBase: "https://api.divine.video",
      pubkey: fixturePubkey,
      signer: new FixtureSigner(),
      fetcher: async () => {
        requests += 1;
        return new Response(
          JSON.stringify({
            data: [makeFixtureEvent({ id: `${requests}`.padStart(64, "0") })],
            pagination: { next_cursor: "same-cursor-forever", has_more: true }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    expect(requests).toBe(2);
    expect(result.events).toHaveLength(2);
    expect(result.failures.map((failure) => failure.code)).toEqual(["stalled-cursor"]);
  });

  it("stops at the page ceiling and reports the archive as incomplete", async () => {
    let requests = 0;

    const result = await exportOwnerEvents({
      endpointBase: "https://api.divine.video",
      pubkey: fixturePubkey,
      signer: new FixtureSigner(),
      maxPages: 2,
      fetcher: async () => {
        requests += 1;
        return new Response(
          JSON.stringify({
            data: [makeFixtureEvent({ id: `${requests}`.padStart(64, "0") })],
            pagination: { next_cursor: `cursor-${requests}`, has_more: true }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    expect(requests).toBe(2);
    expect(result.pageCount).toBe(2);
    expect(result.events).toHaveLength(2);
    expect(result.failures.map((failure) => failure.code)).toEqual(["page-limit"]);
  });

  it("rejects invalid pubkeys before making a request", async () => {
    await expect(
      exportOwnerEvents({
        endpointBase: "https://api.divine.video",
        pubkey: "not-a-pubkey",
        signer: new FixtureSigner(),
        fetcher: createFixtureFetch("one-page")
      })
    ).rejects.toBeInstanceOf(OwnerExportError);
  });
});
