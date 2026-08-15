// ABOUTME: Test fixtures for the owner-export client and archive builders
// ABOUTME: Test-only support code, never imported by production paths

import type { NostrEvent } from "@nostrify/nostrify";

import type { ExportPage } from "../ownerExportClient";

export const fixturePubkey = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const otherFixturePubkey = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
export const fixtureEventIdOne = "1111111111111111111111111111111111111111111111111111111111111111";
export const fixtureEventIdTwo = "2222222222222222222222222222222222222222222222222222222222222222";
export const fixtureMediaHash = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

export function makeFixtureEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: fixtureEventIdOne,
    pubkey: fixturePubkey,
    created_at: 1786550400,
    kind: 34236,
    tags: [
      ["d", "fixture-video-one"],
      ["url", `https://media.divine.video/${fixtureMediaHash}.mp4`],
      ["x", fixtureMediaHash]
    ],
    content: "",
    sig: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    ...overrides
  };
}

export const onePageExport: ExportPage = {
  data: [makeFixtureEvent()],
  pagination: {
    next_cursor: null,
    has_more: false
  }
};

export const multiPageExport: ExportPage[] = [
  {
    data: [makeFixtureEvent()],
    pagination: {
      next_cursor: "550e8400-e29b-41d4-a716-446655440000",
      has_more: true
    }
  },
  {
    data: [
      makeFixtureEvent({
        id: fixtureEventIdTwo,
        tags: [
          ["d", "fixture-video-two"],
          ["imeta", "url https://media.divine.video/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.mp4", "x eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"]
        ]
      })
    ],
    pagination: {
      next_cursor: null,
      has_more: false
    }
  }
];

export const emptyExport: ExportPage = {
  data: [],
  pagination: {
    next_cursor: null,
    has_more: false
  }
};

export type FixtureScenario =
  | "one-page"
  | "multi-page"
  | "empty"
  | "rate-limit"
  | "always-rate-limit"
  | "bad-cursor"
  | "expired-cursor"
  | "auth-failure"
  | "pubkey-mismatch"
  | "network-failure"
  | "server-failure";

export const fixtureScenarioLabels: Record<FixtureScenario, string> = {
  "one-page": "One page",
  "multi-page": "Multiple pages",
  empty: "Empty export",
  "rate-limit": "Rate limit, then retry",
  "always-rate-limit": "Rate limit, no recovery",
  "bad-cursor": "Bad page token",
  "expired-cursor": "Expired page token",
  "auth-failure": "Sign-in failure",
  "pubkey-mismatch": "Wrong account",
  "network-failure": "Network failure",
  "server-failure": "Server failure"
};
