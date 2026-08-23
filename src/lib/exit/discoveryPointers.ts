// ABOUTME: Builds destination-only Nostr discovery pointer templates for account moves
// ABOUTME: Chooses replacement timestamps without relying on replaceable-event tie breaks

import type { NostrEvent } from "@nostrify/nostrify";

import { DISCOVERY_POINTER_RELAYS, PRIMARY_RELAY } from "@/config/relays";

import type { EventTemplate } from "./eventRewrite";
import { normalizeRelayDestinationUrl } from "./relayDestination";

export const RELAY_LIST_KIND = 10_002;
export const BLOSSOM_SERVER_LIST_KIND = 10_063;
export const MAX_REPLACEMENT_FUTURE_SKEW_SECONDS = 1;

export interface PointerPublishTarget {
  relay: string;
  isDiscoveryRelay: boolean;
}

export function pointerPublishTargets(input: {
  relayDestination: string;
  discoveryRelays?: readonly string[];
}): PointerPublishTarget[] {
  const destination = normalizeRelayDestinationUrl(input.relayDestination);
  const divineRelay = normalizeRelayDestinationUrl(PRIMARY_RELAY.url);
  const discoveryRelays = input.discoveryRelays
    ?? DISCOVERY_POINTER_RELAYS.map((relay) => relay.url);
  const targets = new Map<string, PointerPublishTarget>([
    [destination, { relay: destination, isDiscoveryRelay: false }],
  ]);

  for (const relay of discoveryRelays) {
    const normalized = normalizeRelayDestinationUrl(relay);
    targets.set(normalized, {
      relay: normalized,
      // Divine's own relay is still published to, so an app that knows the old
      // home can follow the move. It is not somewhere another app looks for
      // one, so it must never be what makes a pointer count as discoverable.
      isDiscoveryRelay: normalized !== divineRelay,
    });
  }

  return [...targets.values()];
}

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
