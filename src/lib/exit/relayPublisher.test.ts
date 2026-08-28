import type { NostrEvent, NostrSigner } from "@nostrify/nostrify";
import { describe, expect, it, vi } from "vitest";

import type { MirrorResult } from "./mirrorClient";
import { publishArchiveEvents, summarizePublishResults } from "./relayPublisher";

const PUBKEY = "a".repeat(64);
const SOURCE = `https://media.divine.video/${"b".repeat(64)}.mp4`;
const DESTINATION_MEDIA = `https://blossom.example/${"b".repeat(64)}`;
const SECOND_SOURCE = `https://media.divine.video/${"c".repeat(64)}.mp4`;
const SECOND_DESTINATION_MEDIA = `https://blossom.example/${"c".repeat(64)}`;
const RELAY = "wss://relay.example/nostr";
// Fixtures sit inside the publisher's default relay age window, so only the
// tests that pass their own nowSeconds and relayAgeLimitSeconds exercise
// re-dating. A fixed literal would drift out of that window as the clock
// advances and would silently re-date every fixture instead.
const FIXTURE_CREATED_AT = Math.floor(Date.now() / 1000) - 1_000;

function makeEvent(idChar: string, overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: idChar.repeat(64),
    pubkey: PUBKEY,
    sig: idChar.repeat(128),
    kind: 1,
    created_at: FIXTURE_CREATED_AT,
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

function mirrorResult(source = SOURCE, destination = DESTINATION_MEDIA): MirrorResult {
  return {
    references: [{ event_id: "1".repeat(64), tag: "url", url: source, sha256: "b".repeat(64) }],
    source_url: source,
    destination_url: destination,
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
    expect(relay.published[0].created_at).toBeGreaterThan(video.created_at);
    expect(relay.published[1].created_at).toBe(comment.created_at);
    expect(relay.published[2].created_at).toBe(reply.created_at);
    expect(relay.published[1].tags).toEqual([["E", relay.published[0].id], ["e", relay.published[0].id]]);
    expect(relay.published[2].tags).toEqual([["E", relay.published[0].id], ["e", relay.published[1].id]]);
    expect(results.every((result) => result.status === "published")).toBe(true);
  });

  it("republishes a profile with its mirrored picture URL", async () => {
    const signer = makeSigner();
    const relay = fakeRelay();
    const profile = makeEvent("1", {
      kind: 0,
      content: JSON.stringify({ name: "Fixture profile", picture: SOURCE }),
    });

    const results = await publishArchiveEvents({
      destination: RELAY,
      events: [profile],
      mirrorResults: [mirrorResult()],
      signer,
      relayFactory: () => relay,
    });

    expect(JSON.parse(relay.published[0].content)).toEqual({
      name: "Fixture profile",
      picture: DESTINATION_MEDIA,
    });
    expect(results[0]).toMatchObject({ status: "published", remaining_media_urls: 0 });
  });

  it("produces the same replacement templates on repeated runs", async () => {
    const signer = makeSigner();
    const video = makeEvent("1", { kind: 34236, content: SOURCE, tags: [["url", SOURCE]] });
    const firstRelay = fakeRelay();
    const secondRelay = fakeRelay();
    await publishArchiveEvents({ destination: RELAY, events: [video], mirrorResults: [mirrorResult()], signer, relayFactory: () => firstRelay });
    await publishArchiveEvents({ destination: RELAY, events: [video], mirrorResults: [mirrorResult()], signer, relayFactory: () => secondRelay });

    expect(signer.signEvent).toHaveBeenNthCalledWith(2, signer.signEvent.mock.calls[0][0]);
    expect(secondRelay.published[0]).toMatchObject({
      kind: firstRelay.published[0].kind,
      created_at: firstRelay.published[0].created_at,
      content: firstRelay.published[0].content,
      tags: firstRelay.published[0].tags,
    });
  });

  it("publishes destination-hosted media unchanged on a repeat run", async () => {
    const signer = makeSigner();
    const relay = fakeRelay();
    const video = makeEvent("1", { kind: 34236, content: DESTINATION_MEDIA, tags: [["url", DESTINATION_MEDIA]] });
    const alreadyPresent = mirrorResult(DESTINATION_MEDIA, DESTINATION_MEDIA);
    alreadyPresent.verification = "already-present";

    const results = await publishArchiveEvents({
      destination: RELAY,
      events: [video],
      mirrorResults: [alreadyPresent],
      signer,
      relayFactory: () => relay,
    });

    expect(results).toMatchObject([{ status: "unchanged", remaining_media_urls: 0 }]);
    expect(relay.published).toEqual([video]);
    expect(signer.signEvent).not.toHaveBeenCalled();
    expect(summarizePublishResults(results).remainingMediaUrls).toBe(0);
  });

  it("advances an addressable event changed only by reference rewriting", async () => {
    const signer = makeSigner();
    const relay = fakeRelay();
    const video = makeEvent("1", { kind: 34236, content: SOURCE, tags: [["d", "vid"], ["url", SOURCE]] });
    // A curation set carries no media of its own, so only the rewritten `e` tag
    // changes it — and it still has to beat the copy that points at Divine.
    const playlist = makeEvent("3", { kind: 30_005, created_at: 1_700_000_900, content: "", tags: [["d", "list"], ["e", video.id]] });

    await publishArchiveEvents({ destination: RELAY, events: [video, playlist], mirrorResults: [mirrorResult()], signer, relayFactory: () => relay });

    expect(relay.published[1].created_at).toBeGreaterThan(playlist.created_at);
    expect(relay.published[1].tags).toContainEqual(["e", relay.published[0].id]);
  });

  it("gives a richer later replacement a newer timestamp", async () => {
    const video = makeEvent("1", {
      kind: 34236,
      content: `${SOURCE} ${SECOND_SOURCE}`,
      tags: [["url", SOURCE], ["thumb", SECOND_SOURCE]],
    });
    const firstRelay = fakeRelay();
    const secondRelay = fakeRelay();
    const signer = makeSigner();

    await publishArchiveEvents({ destination: RELAY, events: [video], mirrorResults: [mirrorResult()], signer, relayFactory: () => firstRelay, nowSeconds: video.created_at + 100 });
    await publishArchiveEvents({
      destination: RELAY,
      events: [video],
      mirrorResults: [mirrorResult(), mirrorResult(SECOND_SOURCE, SECOND_DESTINATION_MEDIA)],
      signer,
      relayFactory: () => secondRelay,
      nowSeconds: video.created_at + 101,
    });

    expect(secondRelay.published[0].created_at).toBeGreaterThan(firstRelay.published[0].created_at);
    expect(firstRelay.published[0].content).toContain(SECOND_SOURCE);
    expect(secondRelay.published[0].content).toBe(`${DESTINATION_MEDIA} ${SECOND_DESTINATION_MEDIA}`);
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

  it("preserves completed results when the signer refuses NIP-42 relay access", async () => {
    const signer = makeSigner();
    signer.signEvent.mockRejectedValueOnce(new Error("not allowed"));
    const close = vi.fn().mockResolvedValue(undefined);
    let publishCount = 0;
    const results = await publishArchiveEvents({
      destination: RELAY,
      events: [makeEvent("1"), makeEvent("2"), makeEvent("3")],
      mirrorResults: [],
      signer,
      relayFactory: (_url, options) => ({
        close,
        event: vi.fn((_event, publishOptions) => {
          publishCount += 1;
          if (publishCount === 1) return Promise.resolve();
          return new Promise<void>((_resolve, reject) => {
            publishOptions?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
            void options.auth("challenge").catch(() => undefined);
          });
        }),
      }),
    });
    expect(results.map((result) => result.status)).toEqual(["unchanged", "failed", "failed"]);
    expect(results.slice(1)).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "Your signer refused the relay's access request." }),
    ]));
    expect(summarizePublishResults(results)).toMatchObject({ unchanged: 1, failed: 2 });
    expect(publishCount).toBe(2);
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

  it("rejects a replacement when the signer changes its timestamp", async () => {
    const signer = makeSigner();
    signer.signEvent.mockImplementationOnce(async (template) => ({
      ...template,
      created_at: template.created_at - 1,
      id: "f".repeat(64),
      pubkey: PUBKEY,
      sig: "f".repeat(128),
    }));
    const relay = fakeRelay();
    const changed = makeEvent("1", { kind: 34236, content: SOURCE, tags: [["url", SOURCE]] });

    const results = await publishArchiveEvents({
      destination: RELAY,
      events: [changed],
      mirrorResults: [mirrorResult()],
      signer,
      relayFactory: () => relay,
    });

    expect(results[0]).toMatchObject({
      status: "failed",
      reason: expect.stringContaining("signer changed this event's timestamp"),
    });
    expect(relay.event).not.toHaveBeenCalled();
  });

  it("re-dates old videos before signing the reference graph", async () => {
    const signer = makeSigner();
    const relay = fakeRelay();
    const video = makeEvent("1", {
      kind: 34236,
      created_at: 100,
      tags: [["d", "archived-loop"], ["published_at", "80"]],
    });
    const comment = makeEvent("2", { kind: 1111, created_at: 100, tags: [["E", video.id], ["e", video.id]] });
    const results = await publishArchiveEvents({
      destination: RELAY,
      events: [comment, video],
      mirrorResults: [],
      signer,
      relayFactory: () => relay,
      nowSeconds: 1_000,
      relayAgeLimitSeconds: 500,
    });

    expect(relay.published[0]).toMatchObject({ kind: 34236, created_at: 1_000, tags: expect.arrayContaining([["published_at", "80"]]) });
    expect(relay.published[1]).toMatchObject({ kind: 1111, created_at: 100 });
    expect(relay.published[1].tags).toEqual([["E", relay.published[0].id], ["e", relay.published[0].id]]);
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ event_id: video.id, status: "published", redated: true }),
      expect.objectContaining({ event_id: comment.id, status: "published", redated: false }),
    ]));
  });

  it("does not re-date old non-video events", async () => {
    const signer = makeSigner();
    const relay = fakeRelay();
    const note = makeEvent("1", { kind: 1, created_at: 100 });
    const results = await publishArchiveEvents({
      destination: RELAY,
      events: [note],
      mirrorResults: [],
      signer,
      relayFactory: () => relay,
      nowSeconds: 1_000,
      relayAgeLimitSeconds: 500,
    });

    expect(relay.published).toEqual([note]);
    expect(results[0]).toMatchObject({ status: "unchanged", redated: false });
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

  it("keeps old videos unchanged when the relay declares no lower age bound", async () => {
    const signer = makeSigner();
    const relay = fakeRelay();
    const video = makeEvent("1", { kind: 34236, created_at: 100 });

    const results = await publishArchiveEvents({
      destination: RELAY,
      events: [video],
      mirrorResults: [],
      signer,
      relayFactory: () => relay,
      nowSeconds: 1_000,
      relayAgeLimitSeconds: 0,
    });

    expect(relay.published).toEqual([video]);
    expect(results[0]).toMatchObject({ status: "unchanged", redated: false });
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

  it("reports a signer refusal instead of publishing an old video unchanged", async () => {
    const signer = makeSigner();
    signer.signEvent.mockRejectedValueOnce(new Error("not allowed"));
    const relay = fakeRelay();
    const video = makeEvent("1", { kind: 34236, created_at: 100, tags: [["d", "archived-loop"]] });
    const results = await publishArchiveEvents({
      destination: RELAY,
      events: [video],
      mirrorResults: [],
      signer,
      relayFactory: () => relay,
      nowSeconds: 1_000,
      relayAgeLimitSeconds: 500,
    });

    expect(results[0]).toMatchObject({ status: "failed", redated: true, reason: expect.stringContaining("signer refused") });
    expect(relay.event).not.toHaveBeenCalled();
  });
});

describe("summarizePublishResults", () => {
  it("reports every terminal state and remaining media URL", () => {
    expect(summarizePublishResults([
      { event_id: "1".repeat(64), published_event_id: "a".repeat(64), kind: 1, status: "published", remaining_media_urls: 2, redated: true },
      { event_id: "2".repeat(64), published_event_id: "2".repeat(64), kind: 1, status: "unchanged", remaining_media_urls: 0, redated: false },
      { event_id: "3".repeat(64), published_event_id: null, kind: 4, status: "skipped", remaining_media_urls: 0, redated: false },
      { event_id: "4".repeat(64), published_event_id: null, kind: 1, status: "failed", remaining_media_urls: 1, redated: false },
    ])).toEqual({ published: 1, unchanged: 1, skipped: 1, failed: 1, redated: 1, remainingMediaUrls: 3 });
  });
});
