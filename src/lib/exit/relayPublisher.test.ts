import type { NostrEvent, NostrSigner } from "@nostrify/nostrify";
import { describe, expect, it, vi } from "vitest";

import type { MirrorResult } from "./mirrorClient";
import { publishArchiveEvents, summarizePublishResults } from "./relayPublisher";

const PUBKEY = "a".repeat(64);
const SOURCE = `https://media.divine.video/${"b".repeat(64)}.mp4`;
const DESTINATION_MEDIA = `https://blossom.example/${"b".repeat(64)}`;
const RELAY = "wss://relay.example/nostr";

function makeEvent(idChar: string, overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: idChar.repeat(64),
    pubkey: PUBKEY,
    sig: idChar.repeat(128),
    kind: 1,
    created_at: 1_700_000_000,
    content: "hello",
    tags: [],
    ...overrides,
  };
}

function makeSigner(): NostrSigner & { signEvent: ReturnType<typeof vi.fn> } {
  let counter = 0;
  return {
    getPublicKey: vi.fn().mockResolvedValue(PUBKEY),
    nip04: undefined,
    nip44: undefined,
    signEvent: vi.fn(async (template: Omit<NostrEvent, "id" | "pubkey" | "sig">) => {
      counter += 1;
      return { ...template, id: counter.toString(16).padStart(64, "0"), pubkey: PUBKEY, sig: counter.toString(16).repeat(128).slice(0, 128) };
    }),
  } as unknown as NostrSigner & { signEvent: ReturnType<typeof vi.fn> };
}

function mirrorResult(): MirrorResult {
  return {
    references: [{ event_id: "1".repeat(64), tag: "url", url: SOURCE, sha256: "b".repeat(64) }],
    source_url: SOURCE,
    destination_url: DESTINATION_MEDIA,
    expected_sha256: "b".repeat(64),
    destination_sha256: "b".repeat(64),
    byte_size: 10,
    verification: "descriptor-verified",
  };
}

function fakeRelay(responses: Array<Error | "ok"> = []) {
  const published: NostrEvent[] = [];
  const close = vi.fn().mockResolvedValue(undefined);
  return {
    published,
    close,
    event: vi.fn(async (event: NostrEvent) => {
      published.push(event);
      const response = responses.shift() ?? "ok";
      if (response instanceof Error) throw response;
    }),
  };
}

describe("publishArchiveEvents", () => {
  it("publishes unchanged signed events without asking the signer", async () => {
    const signer = makeSigner();
    const relay = fakeRelay();
    const original = makeEvent("1");
    const results = await publishArchiveEvents({
      destination: RELAY,
      events: [original],
      mirrorResults: [],
      signer,
      relayFactory: () => relay,
    });
    expect(relay.published).toEqual([original]);
    expect(signer.signEvent).not.toHaveBeenCalled();
    expect(results[0]).toMatchObject({ status: "unchanged", event_id: original.id, published_event_id: original.id });
    expect(relay.close).toHaveBeenCalledOnce();
  });

  it("rewrites, signs, and publishes referenced events before forward dependants", async () => {
    const signer = makeSigner();
    const relay = fakeRelay();
    const video = makeEvent("1", { kind: 34236, content: SOURCE, tags: [["url", SOURCE]] });
    const comment = makeEvent("2", { kind: 1111, tags: [["E", video.id], ["e", video.id]] });
    const reply = makeEvent("3", { kind: 1111, tags: [["E", video.id], ["e", comment.id]] });
    const results = await publishArchiveEvents({
      destination: RELAY,
      events: [reply, comment, video],
      mirrorResults: [mirrorResult()],
      signer,
      relayFactory: () => relay,
    });
    expect(relay.published.map((event) => event.kind)).toEqual([34236, 1111, 1111]);
    expect(relay.published[1].tags).toEqual([["E", relay.published[0].id], ["e", relay.published[0].id]]);
    expect(relay.published[2].tags).toEqual([["E", relay.published[0].id], ["e", relay.published[1].id]]);
    expect(results.every((result) => result.status === "published")).toBe(true);
  });

  it("replaces serialized repost content with the newly signed referenced event", async () => {
    const signer = makeSigner();
    const relay = fakeRelay();
    const video = makeEvent("1", { kind: 34236, content: SOURCE, tags: [["url", SOURCE]] });
    const repost = makeEvent("2", { kind: 16, content: JSON.stringify(video), tags: [["e", video.id]] });
    await publishArchiveEvents({ destination: RELAY, events: [repost, video], mirrorResults: [mirrorResult()], signer, relayFactory: () => relay });
    expect(JSON.parse(relay.published[1].content)).toEqual(relay.published[0]);
  });

  it("reports circular owner references instead of publishing dangling replacements", async () => {
    const first = makeEvent("1", { tags: [["e", "2".repeat(64)]] });
    const second = makeEvent("2", { tags: [["e", first.id]] });
    const relay = fakeRelay();
    const results = await publishArchiveEvents({ destination: RELAY, events: [first, second], mirrorResults: [], signer: makeSigner(), relayFactory: () => relay });
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.status === "failed" && result.reason?.includes("circular reference"))).toBe(true);
    expect(relay.event).not.toHaveBeenCalled();
  });

  it("skips encrypted, ephemeral, and destructive events", async () => {
    const signer = makeSigner();
    const relay = fakeRelay();
    const results = await publishArchiveEvents({
      destination: RELAY,
      events: [makeEvent("1", { kind: 4 }), makeEvent("2", { kind: 22242 }), makeEvent("3", { kind: 5 })],
      mirrorResults: [],
      signer,
      relayFactory: () => relay,
    });
    expect(results.map((result) => result.status)).toEqual(["skipped", "skipped", "skipped"]);
    expect(relay.event).not.toHaveBeenCalled();
  });

  it("counts duplicate refusals as success", async () => {
    const relay = fakeRelay([new Error("duplicate: already stored")]);
    const results = await publishArchiveEvents({ destination: RELAY, events: [makeEvent("1")], mirrorResults: [], signer: makeSigner(), relayFactory: () => relay });
    expect(results[0]).toMatchObject({ status: "unchanged", reason: "The relay already has this event." });
  });

  it("backs off and retries a bounded rate limit", async () => {
    const relay = fakeRelay([new Error("rate-limited: slow down"), "ok"]);
    const wait = vi.fn().mockResolvedValue(undefined);
    const results = await publishArchiveEvents({ destination: RELAY, events: [makeEvent("1")], mirrorResults: [], signer: makeSigner(), relayFactory: () => relay, wait });
    expect(relay.event).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(1000, undefined);
    expect(results[0].status).toBe("unchanged");
  });

  it.each([
    ["blocked: policy", "blocked this event"],
    ["restricted: members only", "restricts this event"],
    ["invalid: bad tags", "event is invalid"],
    ["pow: 24 bits", "requires proof of work"],
    ["unrecognized response", "unrecognized response"],
  ])("reports %s clearly and continues", async (message, expected) => {
    const relay = fakeRelay([new Error(message), "ok"]);
    const results = await publishArchiveEvents({ destination: RELAY, events: [makeEvent("1"), makeEvent("2")], mirrorResults: [], signer: makeSigner(), relayFactory: () => relay });
    expect(results[0]).toMatchObject({ status: "failed" });
    expect(results[0].reason).toContain(expected);
    expect(results[1].status).toBe("unchanged");
  });

  it("times out a relay that never returns a valid OK and closes it", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const relay = {
      close,
      event: vi.fn((_event: NostrEvent, options?: { signal?: AbortSignal }) => new Promise<void>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      })),
    };
    const results = await publishArchiveEvents({ destination: RELAY, events: [makeEvent("1")], mirrorResults: [], signer: makeSigner(), relayFactory: () => relay, eventTimeoutMs: 1 });
    expect(results[0]).toMatchObject({ status: "failed", reason: "The relay did not answer before the publish timed out." });
    expect(close).toHaveBeenCalledOnce();
  });

  it("passes a NIP-42 callback that signs the full relay URL and challenge", async () => {
    const signer = makeSigner();
    const relay = fakeRelay();
    let auth: ((challenge: string) => Promise<NostrEvent>) | undefined;
    await publishArchiveEvents({
      destination: RELAY,
      events: [makeEvent("1")],
      mirrorResults: [],
      signer,
      relayFactory: (_url, options) => {
        auth = options.auth;
        return relay;
      },
    });
    await auth!("full challenge value");
    expect(signer.signEvent).toHaveBeenCalledWith(expect.objectContaining({
      kind: 22242,
      tags: [["relay", RELAY], ["challenge", "full challenge value"]],
    }));
  });

  it("stops clearly when the signer refuses NIP-42 relay access", async () => {
    const signer = makeSigner();
    signer.signEvent.mockRejectedValueOnce(new Error("not allowed"));
    const close = vi.fn().mockResolvedValue(undefined);
    await expect(publishArchiveEvents({
      destination: RELAY,
      events: [makeEvent("1")],
      mirrorResults: [],
      signer,
      relayFactory: (_url, options) => ({
        close,
        event: vi.fn((_event, publishOptions) => new Promise<void>((_resolve, reject) => {
          publishOptions?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
          void options.auth("challenge").catch(() => undefined);
        })),
      }),
    })).rejects.toMatchObject({
      code: "auth-required",
      message: "Your signer refused the relay's access request.",
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("republishes after a NIP-42 relay answers the first events with auth-required", async () => {
    const published: NostrEvent[] = [];
    let authenticated = false;
    const results = await publishArchiveEvents({
      destination: RELAY,
      events: [makeEvent("1"), makeEvent("2")],
      mirrorResults: [],
      signer: makeSigner(),
      wait: vi.fn().mockResolvedValue(undefined),
      relayFactory: (_url, options) => {
        // A NIP-42 relay challenges on connect. The signer answers it while the
        // first events are already on the wire, so those come back refused.
        void options.auth("challenge").then(() => { authenticated = true; });
        return {
          close: vi.fn().mockResolvedValue(undefined),
          event: vi.fn(async (event: NostrEvent) => {
            if (!authenticated) throw new Error("auth-required: we only accept events from authenticated users");
            published.push(event);
          }),
        };
      },
    });
    expect(published).toHaveLength(2);
    expect(results.map((result) => result.status)).toEqual(["unchanged", "unchanged"]);
  });

  it("keeps signer refusal local to the changed event", async () => {
    const signer = makeSigner();
    signer.signEvent.mockRejectedValueOnce(new Error("not allowed"));
    const relay = fakeRelay();
    const changed = makeEvent("1", { kind: 34236, content: SOURCE, tags: [["url", SOURCE]] });
    const unchanged = makeEvent("2");
    const results = await publishArchiveEvents({ destination: RELAY, events: [changed, unchanged], mirrorResults: [mirrorResult()], signer, relayFactory: () => relay });
    expect(results.find((result) => result.event_id === changed.id)).toMatchObject({ status: "failed", reason: expect.stringContaining("signer refused") });
    expect(relay.published).toEqual([unchanged]);
  });
});

describe("summarizePublishResults", () => {
  it("reports every terminal state and remaining media URL", () => {
    expect(summarizePublishResults([
      { event_id: "1".repeat(64), published_event_id: "a".repeat(64), kind: 1, status: "published", remaining_media_urls: 2 },
      { event_id: "2".repeat(64), published_event_id: "2".repeat(64), kind: 1, status: "unchanged", remaining_media_urls: 0 },
      { event_id: "3".repeat(64), published_event_id: null, kind: 4, status: "skipped", remaining_media_urls: 0 },
      { event_id: "4".repeat(64), published_event_id: null, kind: 1, status: "failed", remaining_media_urls: 1 },
    ])).toEqual({ published: 1, unchanged: 1, skipped: 1, failed: 1, remainingMediaUrls: 3 });
  });
});
