import { describe, expect, it } from "vitest";

import { fixturePubkey, makeFixtureEvent } from "./__fixtures__/exportFixtures";
import { FixtureSigner } from "./__fixtures__/fixtureSigner";
import { fetchSnapshotStatus, redeemSnapshotEvents } from "./banSnapshotClient";

const enforcementId = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const available = {
  state: "available",
  enforcement_id: enforcementId,
  enforced_at: "2026-08-01T12:00:00Z",
  created_at: "2026-08-01T12:01:00Z",
  expires_at: "2026-08-31T12:01:00Z",
  days_remaining: 3,
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

describe("fetchSnapshotStatus", () => {
  it.each(["available", "absent", "capture_failed", "expired", "temporarily_unavailable"] as const)("validates the %s lifecycle state on 200", async (state) => {
    const body = state === "available" ? available : {
      state, enforcement_id: null, enforced_at: null, created_at: null, expires_at: null, days_remaining: null,
    };
    await expect(fetchSnapshotStatus({ endpointBase: "https://api.divine.video", pubkey: fixturePubkey, signer: new FixtureSigner(), fetcher: async () => json(body) })).resolves.toEqual(body);
  });

  it("treats a 503 lifecycle-shaped body as a transport failure", async () => {
    await expect(fetchSnapshotStatus({ endpointBase: "https://api.divine.video", pubkey: fixturePubkey, signer: new FixtureSigner(), fetcher: async () => json({ ...available, state: "temporarily_unavailable" }, 503) })).rejects.toMatchObject({ code: "server-failure", status: 503 });
  });

  it("rejects malformed successful responses", async () => {
    await expect(fetchSnapshotStatus({ endpointBase: "https://api.divine.video", pubkey: fixturePubkey, signer: new FixtureSigner(), fetcher: async () => json({ state: "available", enforcement_id: enforcementId }) })).rejects.toMatchObject({ code: "malformed-response" });
  });

  it("requires a creation date for an available snapshot", async () => {
    await expect(fetchSnapshotStatus({
      endpointBase: "https://api.divine.video",
      pubkey: fixturePubkey,
      signer: new FixtureSigner(),
      fetcher: async () => json({ ...available, created_at: null }),
    })).rejects.toMatchObject({ code: "malformed-response" });
  });

  it.each([[401, "auth-required"], [403, "pubkey-mismatch"]] as const)("classifies status HTTP %s as %s", async (status, code) => {
    await expect(fetchSnapshotStatus({ endpointBase: "https://api.divine.video", pubkey: fixturePubkey, signer: new FixtureSigner(), fetcher: async () => json({ error: "denied" }, status) })).rejects.toMatchObject({ code });
  });
});

describe("redeemSnapshotEvents", () => {
  it("signs every full page URL including enforcement id and cursor", async () => {
    const signer = new FixtureSigner();
    let page = 0;
    const result = await redeemSnapshotEvents({
      endpointBase: "https://api.divine.video", pubkey: fixturePubkey, enforcementId, signer,
      fetcher: async () => {
        page += 1;
        return json(page === 1
          ? { data: [makeFixtureEvent()], pagination: { has_more: true, next_cursor: "opaque cursor" } }
          : { data: [makeFixtureEvent({ id: "2222222222222222222222222222222222222222222222222222222222222222" })], pagination: { has_more: false, next_cursor: null } });
      },
    });
    expect(result.events).toHaveLength(2);
    expect(signer.signedUrls).toEqual([
      `https://api.divine.video/api/users/${fixturePubkey}/export/snapshot?enforcement_id=${enforcementId}&limit=500`,
      `https://api.divine.video/api/users/${fixturePubkey}/export/snapshot?enforcement_id=${enforcementId}&limit=500&cursor=opaque+cursor`,
    ]);
  });

  it.each([
    [400, { error: "Invalid enforcement_id" }, "invalid-enforcement"],
    [400, { error: "Invalid cursor format" }, "bad-cursor"],
    [403, { error: "You can only access your own account" }, "pubkey-mismatch"],
    [403, { error: "Temporary export snapshot is unavailable" }, "snapshot-unavailable"],
  ] as const)("classifies overloaded %s responses as %s", async (status, body, code) => {
    await expect(redeemSnapshotEvents({ endpointBase: "https://api.divine.video", pubkey: fixturePubkey, enforcementId, signer: new FixtureSigner(), fetcher: async () => json(body, status) })).rejects.toMatchObject({ code });
  });

  it("preserves earlier pages when the snapshot vanishes mid-walk", async () => {
    let page = 0;
    const result = await redeemSnapshotEvents({
      endpointBase: "https://api.divine.video", pubkey: fixturePubkey, enforcementId, signer: new FixtureSigner(),
      fetcher: async () => ++page === 1
        ? json({ data: [makeFixtureEvent()], pagination: { has_more: true, next_cursor: "next" } })
        : json({ error: "Temporary export snapshot is unavailable" }, 403),
    });
    expect(result.events).toHaveLength(1);
    expect(result.failures).toEqual([expect.objectContaining({ code: "snapshot-unavailable" })]);
  });

  it("retries rate limits and caps Retry-After", async () => {
    const sleeps: number[] = [];
    let requests = 0;
    await redeemSnapshotEvents({
      endpointBase: "https://api.divine.video", pubkey: fixturePubkey, enforcementId, signer: new FixtureSigner(),
      fetcher: async () => ++requests === 1
        ? new Response("slow down", { status: 429, headers: { "retry-after": "86400" } })
        : json({ data: [], pagination: { has_more: false, next_cursor: null } }),
      sleep: async (ms) => { sleeps.push(ms); },
    });
    expect(sleeps).toEqual([60_000]);
  });

  it("retries a temporary server overload", async () => {
    const sleeps: number[] = [];
    let requests = 0;
    await redeemSnapshotEvents({
      endpointBase: "https://api.divine.video", pubkey: fixturePubkey, enforcementId, signer: new FixtureSigner(),
      fetcher: async () => ++requests === 1
        ? new Response("temporarily unavailable", { status: 503, headers: { "retry-after": "1" } })
        : json({ data: [], pagination: { has_more: false, next_cursor: null } }),
      sleep: async (ms) => { sleeps.push(ms); },
    });
    expect(requests).toBe(2);
    expect(sleeps).toEqual([1000]);
  });
});
