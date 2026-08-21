// ABOUTME: Builds destination-only Nostr discovery pointer templates for account moves
// ABOUTME: Chooses replacement timestamps without relying on replaceable-event tie breaks

import type { NostrEvent } from "@nostrify/nostrify";

import type { EventTemplate } from "./eventRewrite";

export const RELAY_LIST_KIND = 10_002;
export const BLOSSOM_SERVER_LIST_KIND = 10_063;
export const MAX_REPLACEMENT_FUTURE_SKEW_SECONDS = 1;

export function buildRelayListTemplate(relayUrl: string, createdAt: number): EventTemplate {
  return { kind: RELAY_LIST_KIND, created_at: createdAt, content: "", tags: [["r", relayUrl]] };
}

export function buildBlossomServerListTemplate(serverOrigin: string, createdAt: number): EventTemplate {
  return { kind: BLOSSOM_SERVER_LIST_KIND, created_at: createdAt, content: "", tags: [["server", serverOrigin]] };
}

export function newestPointerCreatedAt(events: NostrEvent[], kind: number, ownerPubkey: string): number | null {
  const timestamps = events
    .filter((event) => event.kind === kind && event.pubkey === ownerPubkey)
    .map((event) => event.created_at);
  return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

export type ReplacementTimestamp =
  | { createdAt: number; blocked?: never; reason?: never }
  | { createdAt?: never; blocked: true; reason: string };

export function replacementCreatedAt(input: {
  nowSeconds: number;
  newestSeconds: number | null;
  toleranceSeconds?: number;
}): ReplacementTimestamp {
  const createdAt = Math.max(input.nowSeconds, (input.newestSeconds ?? -1) + 1);
  if (createdAt > input.nowSeconds + (input.toleranceSeconds ?? 0)) {
    return {
      blocked: true,
      reason: "The existing discovery pointer is too far in the future to replace safely. Fix its timestamp before publishing another one.",
    };
  }
  return { createdAt };
}
