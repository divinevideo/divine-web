// ABOUTME: Pure routing functions for Nostr reads and publishes.
// ABOUTME: Extracted from NostrProvider so the routing rules can be unit-tested
// ABOUTME: without mounting the provider or mocking React context.

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { MUTE_LIST_KIND } from '@/hooks/useModeration';
import { BADGE_RELAYS, PROFILE_RELAYS, getRelayUrls } from '@/config/relays';

const BADGE_KINDS = [30009, 8, 30008];
const LIST_KINDS = [30000, 30001, 30005];

export interface RoutingContext {
  relayUrl: string;
  relayUrls: string[];
  presetRelays?: { url: string }[];
}

export type ReqRouter = (filters: NostrFilter[]) => ReadonlyMap<string, NostrFilter[]>;

export type EventRouter = (event: NostrEvent) => string[];

export function buildReqRouter(ctx: RoutingContext): ReqRouter {
  return (filters) => {
    const result = new Map<string, NostrFilter[]>();

    const profileRelayFilters: NostrFilter[] = [];
    const badgeRelayFilters: NostrFilter[] = [];
    const otherFilters: NostrFilter[] = [];

    for (const filter of filters) {
      if (filter.kinds?.includes(0) || filter.kinds?.includes(3) || filter.kinds?.includes(10011)) {
        profileRelayFilters.push(filter);
      } else if (filter.kinds?.some((k) => BADGE_KINDS.includes(k))) {
        badgeRelayFilters.push(filter);
      } else {
        otherFilters.push(filter);
      }
    }

    if (profileRelayFilters.length > 0) {
      for (const relay of getRelayUrls(PROFILE_RELAYS)) {
        result.set(relay, profileRelayFilters);
      }
    }

    if (badgeRelayFilters.length > 0) {
      for (const relay of BADGE_RELAYS) {
        const existing = result.get(relay.url) || [];
        result.set(relay.url, [...existing, ...badgeRelayFilters]);
      }
    }

    if (otherFilters.length > 0) {
      for (const url of ctx.relayUrls) {
        result.set(url, otherFilters);
      }
    }

    return result;
  };
}

export function buildEventRouter(ctx: RoutingContext): EventRouter {
  return (event) => {
    const allRelays = new Set<string>([ctx.relayUrl]);

    if (event.kind === 0 || event.kind === 3 || event.kind === 10011) {
      getRelayUrls(PROFILE_RELAYS).forEach((url) => allRelays.add(url));
    }

    if (LIST_KINDS.includes(event.kind)) {
      getRelayUrls(PROFILE_RELAYS).forEach((url) => allRelays.add(url));
    }

    // Mute lists must stay primary-relay-only to avoid clobbering a
    // user's populated mute list on public relays where we never read.
    if (event.kind === MUTE_LIST_KIND) {
      return [...allRelays];
    }

    for (const { url } of (ctx.presetRelays ?? [])) {
      allRelays.add(url);
      if (allRelays.size >= 5) break;
    }

    return [...allRelays];
  };
}
