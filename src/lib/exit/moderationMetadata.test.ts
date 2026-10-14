import { describe, expect, it } from "vitest";

import { fixtureEventIdOne, fixtureEventIdTwo } from "./__fixtures__/exportFixtures";
import { dropOrphanAnnotations, parseAnnotations, parseWithheld } from "./moderationMetadata";

describe("moderation metadata", () => {
  it("parses banned and quarantined annotations with full event IDs", () => {
    const result = parseAnnotations({
      [fixtureEventIdOne]: { status: "banned" },
      [fixtureEventIdTwo]: { status: "quarantined" }
    });

    expect(result).toMatchObject({ kind: "available", invalidCount: 0 });
    expect(result.kind === "available" && Array.from(result.annotations)).toEqual([
      [fixtureEventIdOne, "banned"],
      [fixtureEventIdTwo, "quarantined"]
    ]);
  });

  it.each([
    [{ [fixtureEventIdOne]: { status: "reviewed" } }, 1],
    [{ short: { status: "banned" } }, 1],
    [{ [fixtureEventIdOne]: null }, 1],
    [[], 1],
    ["bad", 1]
  ])("keeps malformed annotations from invalidating the event page", (raw, invalidCount) => {
    expect(parseAnnotations(raw)).toMatchObject({ kind: "available", invalidCount });
  });

  it("canonicalises upper-case event IDs so they can match returned events", () => {
    const result = parseAnnotations({ [fixtureEventIdOne.toUpperCase()]: { status: "banned" } });

    expect(result.kind === "available" && Array.from(result.annotations)).toEqual([
      [fixtureEventIdOne, "banned"]
    ]);
  });

  it("reports conflicting statuses whose event IDs differ only by case", () => {
    const eventId = "ab".repeat(32);
    const result = parseAnnotations({
      [eventId]: { status: "banned" },
      [eventId.toUpperCase()]: { status: "quarantined" }
    });

    expect(result).toMatchObject({ kind: "available", conflictingCount: 1 });
    expect(result.kind === "available" && Array.from(result.annotations)).toEqual([
      [eventId, "banned"]
    ]);
  });

  it("distinguishes an absent annotation field from an empty supported field", () => {
    expect(parseAnnotations(undefined)).toEqual({ kind: "unsupported" });
    expect(parseAnnotations({})).toMatchObject({ kind: "available", invalidCount: 0 });
  });

  it.each([
    [{ complete: true, count: 2 }, { kind: "known", count: 2 }],
    [{ complete: true, count: 0 }, { kind: "known", count: 0 }],
    [{ complete: false }, { kind: "unavailable" }],
    [undefined, { kind: "unsupported" }],
    [{ complete: true, count: -1 }, { kind: "unavailable" }],
    [{ complete: true, count: 1.5 }, { kind: "unavailable" }],
    [null, { kind: "unavailable" }]
  ])("parses withheld state %#", (raw, expected) => {
    expect(parseWithheld(raw)).toEqual(expected);
  });

  it("drops annotations that do not belong to returned events", () => {
    const result = dropOrphanAnnotations(
      new Map([[fixtureEventIdOne, "banned"], [fixtureEventIdTwo, "quarantined"]]),
      new Set([fixtureEventIdOne])
    );

    expect(Array.from(result.annotations)).toEqual([[fixtureEventIdOne, "banned"]]);
    expect(result.orphanCount).toBe(1);
  });
});
