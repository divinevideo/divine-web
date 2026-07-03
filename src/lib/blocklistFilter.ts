// ABOUTME: Pure helpers for per-viewer feed blocklist filtering (viewer's blocks/mutes plus
// ABOUTME: muters/blockers-of-viewer), mirroring divine-mobile's ContentBlocklistRepository.shouldFilterFromFeeds

import type { NostrEvent } from '@nostrify/nostrify';
import { MUTE_LIST_KIND } from '@/hooks/useModeration';

// Divine's legacy block list: NIP-51 kind 30000 addressable list with d=block.
// Any other d-tag on kind 30000 (follow sets, etc.) is NOT a block list.
export const BLOCK_LIST_KIND = 30000;
export const BLOCK_LIST_D_TAG = 'block';

function getDTag(event: NostrEvent): string {
  const tag = event.tags.find(t => t[0] === 'd');
  return tag?.[1] ?? '';
}

function hasBlockDTag(event: NostrEvent): boolean {
  return getDTag(event) === BLOCK_LIST_D_TAG;
}

function pTagsInclude(event: NostrEvent, pubkey: string): boolean {
  return event.tags.some(t => t[0] === 'p' && t[1] === pubkey);
}

/**
 * Deduplicate replaceable/addressable events, keeping the canonical copy per key.
 * NIP-01: newest created_at wins; on a tie the lowest event id wins.
 */
function latestEventsByKey(
  events: NostrEvent[],
  keyFn: (event: NostrEvent) => string
): Map<string, NostrEvent> {
  const latest = new Map<string, NostrEvent>();
  for (const event of events) {
    const key = keyFn(event);
    const existing = latest.get(key);
    if (
      !existing ||
      event.created_at > existing.created_at ||
      (event.created_at === existing.created_at && event.id < existing.id)
    ) {
      latest.set(key, event);
    }
  }
  return latest;
}

/**
 * Authors whose latest kind 10000 mute list p-tags the viewer ("muters-of-viewer").
 * Kind 10000 is replaceable, so only each author's newest event counts — a newer
 * list without the viewer's p-tag means they un-muted the viewer.
 */
export function parseMutersOfViewer(events: NostrEvent[], viewerPubkey: string): string[] {
  const muteEvents = events.filter(
    e => e.kind === MUTE_LIST_KIND && e.pubkey !== viewerPubkey
  );
  const latestByAuthor = latestEventsByKey(muteEvents, e => e.pubkey);
  const muters: string[] = [];
  for (const [author, event] of latestByAuthor) {
    if (pTagsInclude(event, viewerPubkey)) muters.push(author);
  }
  return muters;
}

/**
 * Authors whose latest kind 30000 d=block list p-tags the viewer ("blockers-of-viewer").
 * Addressable events deduplicate by pubkey:kind:d-tag, so a newer kind 30000 list with a
 * different d-tag (e.g. a follow set) never shadows the block list, and only d=block counts.
 */
export function parseBlockersOfViewer(events: NostrEvent[], viewerPubkey: string): string[] {
  const listEvents = events.filter(
    e => e.kind === BLOCK_LIST_KIND && e.pubkey !== viewerPubkey
  );
  const latestByAddress = latestEventsByKey(
    listEvents,
    e => `${e.pubkey}:${e.kind}:${getDTag(e)}`
  );
  const blockers: string[] = [];
  for (const event of latestByAddress.values()) {
    if (hasBlockDTag(event) && pTagsInclude(event, viewerPubkey)) {
      blockers.push(event.pubkey);
    }
  }
  return blockers;
}

/**
 * Pubkeys on the viewer's own latest kind 30000 d=block list (blocks published by
 * Divine mobile). Self-references are dropped so a malformed list can never hide
 * the viewer's own content.
 */
export function parseOwnBlockedPubkeys(events: NostrEvent[], viewerPubkey: string): string[] {
  const ownBlockEvents = events.filter(
    e => e.kind === BLOCK_LIST_KIND && e.pubkey === viewerPubkey && hasBlockDTag(e)
  );
  const latest = latestEventsByKey(ownBlockEvents, () => 'own').get('own');
  if (!latest) return [];
  const blocked: string[] = [];
  for (const tag of latest.tags) {
    if (tag[0] === 'p' && tag[1] && tag[1] !== viewerPubkey) blocked.push(tag[1]);
  }
  return blocked;
}

export interface FeedBlocklistSources {
  viewerPubkey?: string;
  /** Pubkeys the viewer muted on their own kind 10000 mute list */
  ownMutedPubkeys?: Iterable<string>;
  /** Pubkeys the viewer blocked on their own kind 30000 d=block list */
  ownBlockedPubkeys?: Iterable<string>;
  /** Authors whose kind 10000 mute list p-tags the viewer */
  mutersOfViewer?: Iterable<string>;
  /** Authors whose kind 30000 d=block list p-tags the viewer */
  blockersOfViewer?: Iterable<string>;
}

/**
 * Union of every pubkey hidden from feeds. The viewer's own pubkey is always
 * excluded so no list — malformed or hostile — can filter their own content.
 */
export function buildFeedBlocklist(sources: FeedBlocklistSources): Set<string> {
  const set = new Set<string>();
  const buckets = [
    sources.ownMutedPubkeys,
    sources.ownBlockedPubkeys,
    sources.mutersOfViewer,
    sources.blockersOfViewer,
  ];
  for (const bucket of buckets) {
    if (!bucket) continue;
    for (const pubkey of bucket) set.add(pubkey);
  }
  if (sources.viewerPubkey) set.delete(sources.viewerPubkey);
  return set;
}

/**
 * Drop videos authored by blocked/muted pubkeys. Returns the input array
 * unchanged (same reference) when nothing is filtered, for render stability.
 */
export function filterBlockedVideos<T extends { pubkey: string }>(
  videos: T[],
  blockedPubkeys: ReadonlySet<string>
): T[] {
  if (videos.length === 0 || blockedPubkeys.size === 0) return videos;
  const filtered = videos.filter(v => !blockedPubkeys.has(v.pubkey));
  return filtered.length === videos.length ? videos : filtered;
}

/**
 * Apply filterBlockedVideos across an infinite-query result's pages.
 * Preserves object identity (data, untouched pages) when nothing changes.
 */
export function filterBlockedVideoPages<
  TPage extends { videos: { pubkey: string }[] },
  TData extends { pages: TPage[] }
>(data: TData | undefined, blockedPubkeys: ReadonlySet<string>): TData | undefined {
  if (!data || blockedPubkeys.size === 0) return data;
  let changed = false;
  const pages = data.pages.map(page => {
    const videos = filterBlockedVideos(page.videos, blockedPubkeys);
    if (videos === page.videos) return page;
    changed = true;
    return { ...page, videos };
  });
  return changed ? { ...data, pages } : data;
}
