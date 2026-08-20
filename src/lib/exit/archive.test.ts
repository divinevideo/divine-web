import { describe, expect, it } from "vitest";

import { fixtureMediaHash, fixturePubkey, makeFixtureEvent } from "./__fixtures__/exportFixtures";
import { buildArchiveFiles, completeArchiveMedia, discoverMediaReferences, serializeArchiveFiles } from "./archive";

describe("archive builder", () => {
  it("preserves raw events and writes manifest metadata", () => {
    const event = makeFixtureEvent();
    const archive = buildArchiveFiles({
      events: [event],
      pubkey: fixturePubkey,
      sourceEndpoint: "https://api.divine.video",
      pageCount: 1,
      failures: [],
      generatedAt: new Date("2026-08-12T21:00:00Z")
    });

    expect(archive["events.json"]).toEqual([event]);
    expect(archive["manifest.json"]).toEqual({
      pubkey: fixturePubkey,
      generated_at: "2026-08-12T21:00:00.000Z",
      event_count: 1,
      source_name: "Divine relay",
      source_endpoint: "https://api.divine.video",
      page_count: 1,
      failures: []
    });
  });

  it("discovers media URLs and hashes from tags", () => {
    const references = discoverMediaReferences([
      makeFixtureEvent(),
      makeFixtureEvent({
        id: "2222222222222222222222222222222222222222222222222222222222222222",
        tags: [
          [
            "imeta",
            "url https://media.divine.video/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.mp4",
            "x eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
          ]
        ]
      })
    ]);

    expect(references).toEqual([
      {
        event_id: "1111111111111111111111111111111111111111111111111111111111111111",
        tag: "url",
        url: `https://media.divine.video/${fixtureMediaHash}.mp4`,
        sha256: fixtureMediaHash
      },
      {
        event_id: "2222222222222222222222222222222222222222222222222222222222222222",
        tag: "imeta",
        url: "https://media.divine.video/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.mp4",
        sha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
      }
    ]);
  });

  it("uses a sibling x tag when the URL does not carry a hash", () => {
    const hash = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const references = discoverMediaReferences([
      makeFixtureEvent({
        tags: [
          ["url", "https://cdn.example.com/video.mp4"],
          ["x", hash]
        ]
      })
    ]);

    expect(references).toEqual([
      {
        event_id: "1111111111111111111111111111111111111111111111111111111111111111",
        tag: "url",
        url: "https://cdn.example.com/video.mp4",
        sha256: hash
      }
    ]);
  });

  it("does not apply a sibling x hash to thumb or image URLs", () => {
    const videoHash = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const thumbHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const references = discoverMediaReferences([
      makeFixtureEvent({
        tags: [
          ["url", "https://cdn.example.com/video.mp4"],
          ["thumb", `https://media.divine.video/${thumbHash}.jpg`],
          ["x", videoHash]
        ]
      })
    ]);

    expect(references).toEqual([
      {
        event_id: "1111111111111111111111111111111111111111111111111111111111111111",
        tag: "url",
        url: "https://cdn.example.com/video.mp4",
        sha256: videoHash
      },
      {
        event_id: "1111111111111111111111111111111111111111111111111111111111111111",
        tag: "thumb",
        url: `https://media.divine.video/${thumbHash}.jpg`,
        sha256: thumbHash
      }
    ]);
  });

  it("does not apply an imeta x hash to a sibling image URL", () => {
    const videoHash = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const imageHash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const references = discoverMediaReferences([
      makeFixtureEvent({
        tags: [
          [
            "imeta",
            "url https://cdn.example.com/video.mp4",
            `image https://media.divine.video/${imageHash}.jpg`,
            `x ${videoHash}`
          ]
        ]
      })
    ]);

    expect(references).toEqual([
      {
        event_id: "1111111111111111111111111111111111111111111111111111111111111111",
        tag: "imeta",
        url: "https://cdn.example.com/video.mp4",
        sha256: videoHash
      },
      {
        event_id: "1111111111111111111111111111111111111111111111111111111111111111",
        tag: "imeta",
        url: `https://media.divine.video/${imageHash}.jpg`,
        sha256: imageHash
      }
    ]);
  });

  it("discovers media in pair-form imeta tags", () => {
    const hash = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const references = discoverMediaReferences([
      makeFixtureEvent({
        tags: [
          ["imeta", "url", "https://cdn.example.com/video.mp4", "x", hash]
        ]
      })
    ]);

    expect(references).toEqual([
      {
        event_id: "1111111111111111111111111111111111111111111111111111111111111111",
        tag: "imeta",
        url: "https://cdn.example.com/video.mp4",
        sha256: hash
      }
    ]);
  });

  it("serializes the three archive files", () => {
    const archive = buildArchiveFiles({
      events: [makeFixtureEvent()],
      pubkey: fixturePubkey,
      sourceEndpoint: "https://api.divine.video",
      pageCount: 1,
      failures: [],
      generatedAt: new Date("2026-08-12T21:00:00Z")
    });

    expect(Object.keys(serializeArchiveFiles(archive))).toEqual(["events.json", "manifest.json", "media.json"]);
  });

  it("merges per-reference results, summarizes blobs, and certifies only trusted paths", () => {
    const archive = buildArchiveFiles({
      events: [makeFixtureEvent()], pubkey: fixturePubkey, sourceEndpoint: "https://api.divine.video",
      pageCount: 1, failures: [], generatedAt: new Date("2026-08-12T21:00:00Z"),
    });
    const reference = archive["media.json"][0];
    const completed = completeArchiveMedia(archive, [
      { references: [reference], source_url: reference.url, expected_sha256: fixtureMediaHash,
        computed_sha256: fixtureMediaHash, byte_size: 5, content_type: "video/mp4",
        archive_path: `media/${fixtureMediaHash}.mp4`, verification: "verified" },
      { references: [{ ...reference, url: "https://example.com/wrong" }], source_url: "https://example.com/wrong",
        expected_sha256: fixtureMediaHash, computed_sha256: "e".repeat(64), byte_size: 4, content_type: "video/mp4",
        archive_path: `media/mismatched/${fixtureMediaHash}.mp4`, verification: "hash-mismatch" },
    ]);
    expect(completed["manifest.json"].media).toEqual({
      media_total: 2, media_verified: 1, media_unverified: 0, media_mismatched: 1, media_failed: 0,
    });
    expect(completed["media.json"]).toHaveLength(2);
    expect(completed["media-checksums.txt"]).toBe(`${fixtureMediaHash}  media/${fixtureMediaHash}.mp4\n`);
  });
});
