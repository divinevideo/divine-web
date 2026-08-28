import type { NostrEvent } from "@nostrify/nostrify";
import { describe, expect, it } from "vitest";

import type { MirrorResult } from "./mirrorClient";
import {
  buildDestinationRewrite,
  referencedEventIds,
  republishCreatedAt,
  republishSkipReason,
  rewriteEventMedia,
  rewriteEventReferences,
} from "./eventRewrite";

const PUBKEY = "a".repeat(64);
const ID = "b".repeat(64);
const SOURCE = `https://media.divine.video/${"c".repeat(64)}.mp4`;
const DESTINATION = `https://blossom.example/${"c".repeat(64)}`;

function event(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: ID,
    pubkey: PUBKEY,
    sig: "d".repeat(128),
    kind: 34236,
    created_at: 1_700_000_000,
    content: `Watch ${SOURCE}`,
    tags: [["url", SOURCE], ["title", "A loop"]],
    ...overrides,
  };
}

function mirror(verification: MirrorResult["verification"] = "descriptor-verified"): MirrorResult {
  return {
    references: [{ event_id: ID, tag: "url", url: SOURCE, sha256: "c".repeat(64) }],
    source_url: SOURCE,
    destination_url: DESTINATION,
    expected_sha256: "c".repeat(64),
    destination_sha256: "c".repeat(64),
    byte_size: 10,
    verification,
  };
}

describe("buildDestinationRewrite", () => {
  it("classifies confirmed mappings, origins, and unconfirmed source URLs", () => {
    const verified = mirror();
    verified.references.push({ event_id: "e".repeat(64), tag: "thumb", url: `${SOURCE}?thumb=1`, sha256: "c".repeat(64) });
    const alreadyPresent = mirror("already-present");
    alreadyPresent.references = [{ event_id: ID, tag: "image", url: DESTINATION, sha256: "c".repeat(64) }];
    alreadyPresent.source_url = DESTINATION;
    alreadyPresent.destination_url = DESTINATION;
    const unverified = mirror("unverified");
    unverified.references = [{ event_id: ID, tag: "url", url: `${SOURCE}?unverified=1`, sha256: "c".repeat(64) }];
    const mismatch = mirror("hash-mismatch");
    mismatch.references = [{ event_id: ID, tag: "url", url: `${SOURCE}?mismatch=1`, sha256: "c".repeat(64) }];
    const rewrite = buildDestinationRewrite([verified, alreadyPresent, unverified, mismatch]);

    expect([...rewrite.urls.entries()]).toEqual([
      [SOURCE, DESTINATION],
      [`${SOURCE}?thumb=1`, DESTINATION],
      [DESTINATION, DESTINATION],
    ]);
    expect([...rewrite.confirmedOrigins]).toEqual(["https://blossom.example"]);
    expect([...rewrite.unconfirmedUrls]).toEqual([`${SOURCE}?unverified=1`, `${SOURCE}?mismatch=1`]);
  });

  it("skips malformed confirmed destination origins", () => {
    const verified = mirror();
    verified.destination_url = "not a URL";

    expect(buildDestinationRewrite([verified]).confirmedOrigins).toEqual(new Set());
  });

  it("uses verified browser uploads", () => {
    const source = "https://storage.googleapis.com/archive/avatar.jpg";
    const destination = "https://blossom.example/uploaded-avatar";
    const uploaded = {
      ...mirror("upload-verified"),
      references: [{ event_id: ID, tag: "picture", url: source, sha256: null }],
      source_url: source,
      destination_url: destination,
      expected_sha256: null,
    };

    expect(buildDestinationRewrite([uploaded]).urls).toEqual(new Map([[source, destination]]));
  });

  it.each<MirrorResult["verification"]>(["failed", "skipped", "hash-mismatch", "unverified"])(
    "keeps %s references unconfirmed",
    (verification) => {
      const result = mirror(verification);
      const rewrite = buildDestinationRewrite([result]);

      expect(rewrite.urls).toEqual(new Map());
      expect(rewrite.confirmedOrigins).toEqual(new Set());
      expect(rewrite.unconfirmedUrls).toEqual(new Set([SOURCE]));
    },
  );
});

describe("rewriteEventMedia", () => {
  it("rewrites direct tags and exact content occurrences while preserving event fields", () => {
    const original = event();
    const result = rewriteEventMedia(original, buildDestinationRewrite([mirror()]));
    expect(result).toEqual({
      changed: true,
      remainingMediaUrls: 0,
      template: {
        kind: 34236,
        created_at: original.created_at,
        content: `Watch ${DESTINATION}`,
        tags: [["url", DESTINATION], ["title", "A loop"]],
      },
    });
    expect(original.tags[0][1]).toBe(SOURCE);
  });

  it("rewrites both imeta encodings without changing order or unrelated values", () => {
    const pairSource = `${SOURCE}?pair=1`;
    const original = event({
      content: "unchanged",
      tags: [
        ["imeta", `url ${SOURCE}`, "m video/mp4", `image ${pairSource}`, `x ${"c".repeat(64)}`],
        ["imeta", "url", pairSource, "m", "video/mp4", "fallback", SOURCE],
      ],
    });
    const second = mirror();
    second.references = [{ event_id: ID, tag: "image", url: pairSource, sha256: "c".repeat(64) }];
    second.destination_url = `${DESTINATION}?pair=1`;
    const result = rewriteEventMedia(original, buildDestinationRewrite([mirror(), second]));
    expect(result.template.tags).toEqual([
      ["imeta", `url ${DESTINATION}`, "m video/mp4", `image ${DESTINATION}?pair=1`, `x ${"c".repeat(64)}`],
      ["imeta", "url", `${DESTINATION}?pair=1`, "m", "video/mp4", "fallback", DESTINATION],
    ]);
  });

  it("leaves unmapped URLs unchanged and reports them", () => {
    const result = rewriteEventMedia(event({ content: "unchanged" }), buildDestinationRewrite([]));
    expect(result.changed).toBe(false);
    expect(result.remainingMediaUrls).toBe(1);
  });

  it("treats an identity mapping as unchanged with no remaining media", () => {
    const original = event({ content: DESTINATION, tags: [["url", DESTINATION]] });
    const alreadyPresent = mirror("already-present");
    alreadyPresent.references = [{ event_id: ID, tag: "url", url: DESTINATION, sha256: "c".repeat(64) }];
    alreadyPresent.source_url = DESTINATION;
    alreadyPresent.destination_url = DESTINATION;
    const result = rewriteEventMedia(original, buildDestinationRewrite([alreadyPresent]));

    expect(result.changed).toBe(false);
    expect(result.remainingMediaUrls).toBe(0);
  });

  it("leaves destination-origin media with no mirror reference unchanged and confirmed", () => {
    const original = event({ content: DESTINATION, tags: [["url", DESTINATION]] });
    const result = rewriteEventMedia(original, buildDestinationRewrite([mirror()]));

    expect(result.changed).toBe(false);
    expect(result.remainingMediaUrls).toBe(0);
    expect(result.template.tags).toEqual(original.tags);
  });

  it("counts destination-looking media when no result confirms its origin", () => {
    const original = event({ content: DESTINATION, tags: [["url", DESTINATION]] });
    const result = rewriteEventMedia(original, buildDestinationRewrite([]));

    expect(result.changed).toBe(false);
    expect(result.remainingMediaUrls).toBe(1);
  });

  it("counts an unconfirmed URL even when another result confirms its origin", () => {
    const unconfirmedUrl = `${DESTINATION}?unconfirmed=1`;
    const unverified = mirror("unverified");
    unverified.references = [{ event_id: ID, tag: "url", url: unconfirmedUrl, sha256: "c".repeat(64) }];
    const original = event({ content: unconfirmedUrl, tags: [["url", unconfirmedUrl]] });
    const result = rewriteEventMedia(original, buildDestinationRewrite([mirror(), unverified]));

    expect(result.remainingMediaUrls).toBe(1);
  });

  it("lets an actual remapping win when the same URL also has an unconfirmed result", () => {
    const unverified = mirror("unverified");
    const result = rewriteEventMedia(event({ content: "unchanged" }), buildDestinationRewrite([mirror(), unverified]));

    expect(result.changed).toBe(true);
    expect(result.remainingMediaUrls).toBe(0);
  });

  it("recognizes the confirmed descriptor origin instead of the source origin", () => {
    const cdnDestination = `https://cdn.example/${"c".repeat(64)}`;
    const verified = mirror();
    verified.destination_url = cdnDestination;
    const original = event({ content: cdnDestination, tags: [["url", cdnDestination]] });
    const result = rewriteEventMedia(original, buildDestinationRewrite([verified]));

    expect(result.changed).toBe(false);
    expect(result.remainingMediaUrls).toBe(0);
  });

  it("counts all direct media tags and both imeta encodings by occurrence", () => {
    const original = event({
      content: "unchanged",
      tags: [
        ["url", DESTINATION],
        ["image", DESTINATION],
        ["thumb", DESTINATION],
        ["thumbnail", DESTINATION],
        ["imeta", `url ${DESTINATION}`, `image ${DESTINATION}`, `fallback ${DESTINATION}`],
        ["imeta", "url", DESTINATION, "thumb", DESTINATION, "thumbnail", DESTINATION],
      ],
    });

    expect(rewriteEventMedia(original, buildDestinationRewrite([])).remainingMediaUrls).toBe(10);
    expect(rewriteEventMedia(original, buildDestinationRewrite([mirror()])).remainingMediaUrls).toBe(0);
  });

  it("counts malformed and relative media URLs conservatively", () => {
    const original = event({ content: "unchanged", tags: [["url", "not a URL"], ["image", "/relative.mp4"]] });

    expect(rewriteEventMedia(original, buildDestinationRewrite([mirror()])).remainingMediaUrls).toBe(2);
  });

  it("rewrites mapped profile media and reports unmapped profile media", () => {
    const banner = `https://media.divine.video/${"e".repeat(64)}.jpg`;
    const original = event({
      kind: 0,
      content: JSON.stringify({ picture: SOURCE, banner }),
      tags: [],
    });

    const result = rewriteEventMedia(original, buildDestinationRewrite([mirror()]));

    expect(result.changed).toBe(true);
    expect(JSON.parse(result.template.content)).toEqual({ picture: DESTINATION, banner });
    expect(result.remainingMediaUrls).toBe(1);
  });

  it("rewrites a kind-0 picture after a verified browser upload", () => {
    const source = "https://storage.googleapis.com/archive/avatar.jpg";
    const destination = "https://blossom.example/uploaded-avatar";
    const uploaded = {
      ...mirror("upload-verified"),
      references: [{ event_id: ID, tag: "picture", url: source, sha256: null }],
      source_url: source,
      destination_url: destination,
      expected_sha256: null,
    };
    const result = rewriteEventMedia(event({
      kind: 0,
      content: JSON.stringify({ name: "Creator", picture: source }),
      tags: [],
    }), buildDestinationRewrite([uploaded]));

    expect(JSON.parse(result.template.content)).toMatchObject({ picture: destination });
    expect(result.remainingMediaUrls).toBe(0);
  });

  it("rewrites mapped profile media when JSON escapes URL slashes", () => {
    const source = "https://storage.googleapis.com/archive/avatar.jpg";
    const destination = "https://blossom.example/uploaded-avatar";
    const content = `{"name":"Creator","picture":"${source.replace(/\//g, "\\/")}"}`;
    const uploaded = {
      ...mirror("upload-verified"),
      references: [{ event_id: ID, tag: "picture", url: source, sha256: null }],
      source_url: source,
      destination_url: destination,
      expected_sha256: null,
    };

    const result = rewriteEventMedia(
      event({ kind: 0, content, tags: [] }),
      buildDestinationRewrite([uploaded]),
    );

    expect(JSON.parse(result.template.content)).toEqual({ name: "Creator", picture: destination });
    expect(result.changed).toBe(true);
    expect(result.remainingMediaUrls).toBe(0);
  });

  it("leaves unreferenced destination-origin profile media unchanged and confirmed", () => {
    const original = event({
      kind: 0,
      content: JSON.stringify({ picture: DESTINATION }),
      tags: [],
    });

    const result = rewriteEventMedia(original, buildDestinationRewrite([mirror()]));

    expect(result.changed).toBe(false);
    expect(result.template.content).toBe(original.content);
    expect(result.remainingMediaUrls).toBe(0);
  });

  it("ignores malformed and non-string profile media while reporting", () => {
    expect(rewriteEventMedia(event({ kind: 0, content: "{", tags: [] }), buildDestinationRewrite([])).remainingMediaUrls).toBe(0);
    expect(rewriteEventMedia(event({
      kind: 0,
      content: JSON.stringify({ picture: 42, banner: "" }),
      tags: [],
    }), buildDestinationRewrite([])).remainingMediaUrls).toBe(0);
  });

  it("does not count a non-URL banner such as a theme color as remaining media", () => {
    const result = rewriteEventMedia(event({
      kind: 0,
      content: JSON.stringify({ picture: SOURCE, banner: "0x27c58b" }),
      tags: [],
    }), buildDestinationRewrite([]));

    expect(result.remainingMediaUrls).toBe(1);
  });
});

describe("event references", () => {
  it("finds full reference ids in tags and repost payloads", () => {
    const referenced = event({ id: "e".repeat(64) });
    const repost = event({ kind: 16, content: JSON.stringify(referenced), tags: [["e", ID], ["q", ID]] });
    expect(referencedEventIds(repost)).toEqual([ID, "e".repeat(64)]);
  });

  it("remaps e, E, and q tags plus serialized repost content", () => {
    const old = event();
    const replacement = event({ id: "f".repeat(64), sig: "1".repeat(128) });
    const repost = event({ kind: 16, content: JSON.stringify(old), tags: [["E", ID], ["q", ID, "wss://relay.example"]] });
    const result = rewriteEventReferences(
      { kind: repost.kind, created_at: repost.created_at, content: repost.content, tags: repost.tags },
      new Map([[ID, replacement]]),
    );
    expect(result.changed).toBe(true);
    expect(result.template.tags).toEqual([["E", replacement.id], ["q", replacement.id, "wss://relay.example"]]);
    expect(JSON.parse(result.template.content)).toEqual(replacement);
  });
});

describe("republishSkipReason", () => {
  it.each([4, 13, 14, 15, 1059, 5, 62, 22242, 24133, 24242, 27235])("skips non-portable kind %s", (kind) => {
    expect(republishSkipReason(kind)).not.toBeNull();
  });

  it.each([0, 1, 3, 7, 16, 1111, 10002, 30005, 34236])("allows durable public kind %s", (kind) => {
    expect(republishSkipReason(kind)).toBeNull();
  });
});

describe("republishCreatedAt", () => {
  it.each([0, 3, 10_000, 19_999, 30_000, 34_236, 39_999])(
    "uses the run time for changed replaceable or addressable kind %s",
    (kind) => {
      const original = event({ kind });
      expect(republishCreatedAt(original, original.created_at + 100)).toBe(original.created_at + 100);
    },
  );

  it("stays newer than a future-dated original", () => {
    const original = event({ kind: 34236 });
    expect(republishCreatedAt(original, original.created_at - 100)).toBe(original.created_at + 1);
  });

  it.each([1, 16, 1111, 9999, 20_000, 29_999, 40_000])(
    "preserves the timestamp for kind %s, which is neither replaceable nor addressable",
    (kind) => {
      const original = event({ kind });
      expect(republishCreatedAt(original, original.created_at + 100)).toBe(original.created_at);
    },
  );
});
