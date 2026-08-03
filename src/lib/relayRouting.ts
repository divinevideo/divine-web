// ABOUTME: Pure routing functions for Nostr reads and publishes.
// ABOUTME: Extracted from NostrProvider so the routing rules can be unit-tested
// ABOUTME: without mounting the provider or mocking React context.

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { MUTE_LIST_KIND } from '@/hooks/useModeration';
import { BADGE_RELAYS, PROFILE_RELAYS, getRelayUrls } from '@/config/relays';
import { VIDEO_KINDS } from '@/types/video';

const BADGE_KINDS = [30009, 8, 30008];
const LIST_KINDS = [30000, 30001, 30005];

export interface RoutingContext {
  relayUrl: string;
  relayUrls: string[];
  customRelayUrls?: string[];
  disabledPresetUrls?: string[];
  presetRelays?: { url: string }[];
  pickTopN?: (urls: string[], n: number, kind?: number) => string[];
  refreshSticky?: (url: string, kind: number) => void;
}

export type ReqRouter = (filters: NostrFilter[]) => ReadonlyMap<string, NostrFilter[]>;

export type EventRouter = (event: NostrEvent) => string[];

function enabledUrls(urls: string[], disabled: ReadonlySet<string>): string[] {
  return urls.filter((url) => !disabled.has(url));
}

function addFilters(
  result: Map<string, NostrFilter[]>,
  relay: string,
  filters: NostrFilter[],
): void {
  result.set(relay, [...(result.get(relay) ?? []), ...filters]);
}

function pick(ctx: RoutingContext, urls: string[], n: number, kind?: number): string[] {
  return ctx.pickTopN ? ctx.pickTopN(urls, n, kind) : urls.slice(0, n);
}

export function buildReqRouter(ctx: RoutingContext): ReqRouter {
  return (filters) => {
    const result = new Map<string, NostrFilter[]>();

    const profileRelayFilters: NostrFilter[] = [];
    const badgeRelayFilters: NostrFilter[] = [];
    const videoFilters: NostrFilter[] = [];
    const otherFilters: NostrFilter[] = [];

    for (const filter of filters) {
      if (filter.kinds?.includes(0) || filter.kinds?.includes(3) || filter.kinds?.includes(10011)) {
        profileRelayFilters.push(filter);
      } else if (filter.kinds?.some((k) => BADGE_KINDS.includes(k))) {
        badgeRelayFilters.push(filter);
      } else if (filter.kinds?.some((k) => VIDEO_KINDS.includes(k))) {
        videoFilters.push(filter);
      } else {
        otherFilters.push(filter);
      }
    }

    const disabled = new Set(ctx.disabledPresetUrls ?? []);
    const profileRelayUrls = enabledUrls(getRelayUrls(PROFILE_RELAYS), disabled);

    if (profileRelayFilters.length > 0) {
      for (const relay of profileRelayUrls) {
        addFilters(result, relay, profileRelayFilters);
      }
    }

    if (badgeRelayFilters.length > 0) {
      const relayUrls = pick(ctx, enabledUrls(getRelayUrls(BADGE_RELAYS), disabled), 3);
      for (const relay of relayUrls) {
        addFilters(result, relay, badgeRelayFilters);
      }
    }

    if (videoFilters.length > 0) {
      const videoKind = VIDEO_KINDS[0];
      const relayUrls = pick(
        ctx,
        enabledUrls(Array.from(new Set([
          ...ctx.relayUrls,
          ...(ctx.customRelayUrls ?? []),
          ...profileRelayUrls,
        ])), disabled),
        2,
        videoKind,
      );
      for (const relay of relayUrls) {
        addFilters(result, relay, videoFilters);
        ctx.refreshSticky?.(relay, videoKind);
      }
    }

    if (otherFilters.length > 0) {
      const relayUrls = pick(
        ctx,
        enabledUrls(Array.from(new Set([
          ...ctx.relayUrls,
          ...(ctx.customRelayUrls ?? []),
        ])), disabled),
        2,
      );
      for (const relay of relayUrls) {
        addFilters(result, relay, otherFilters);
      }
    }

    if (result.size === 0 && ctx.relayUrl) {
      result.set(ctx.relayUrl, filters);
    }

    return result;
  };
}

export function buildEventRouter(ctx: RoutingContext): EventRouter {
  return (event) => {
    const disabled = new Set(ctx.disabledPresetUrls ?? []);
    const allRelays = new Set<string>([ctx.relayUrl]);
    const profileRelayUrls = enabledUrls(getRelayUrls(PROFILE_RELAYS), disabled);

    if (event.kind === 0 || event.kind === 3 || event.kind === 10011) {
      profileRelayUrls.forEach((url) => allRelays.add(url));
    }

    if (LIST_KINDS.includes(event.kind)) {
      profileRelayUrls.forEach((url) => allRelays.add(url));
    }

    // Mute lists must stay primary-relay-only to avoid clobbering a
    // user's populated mute list on public relays where we never read.
    if (event.kind === MUTE_LIST_KIND) {
      return [...allRelays];
    }

    for (const url of ctx.customRelayUrls ?? []) {
      if (!disabled.has(url)) allRelays.add(url);
    }

    const isProfileOrList =
      event.kind === 0 ||
      event.kind === 3 ||
      event.kind === 10011 ||
      LIST_KINDS.includes(event.kind);

    if (!isProfileOrList) {
      for (const { url } of (ctx.presetRelays ?? [])) {
        if (disabled.has(url)) continue;
        allRelays.add(url);
        if (allRelays.size >= 5) break;
      }
    }

    const ranked = pick(ctx, [...allRelays], 5);
    if (isProfileOrList) {
      return Array.from(new Set([...ranked, ...profileRelayUrls]));
    }
    return ranked;
  };
}
