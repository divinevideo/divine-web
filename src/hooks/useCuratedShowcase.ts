// ABOUTME: Loads the hand-curated, all-ages showcase reel for the public web
// ABOUTME: Reads an allowlisted curator's titled kind 30005 list, then applies a safety floor

import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { getEventLookupRelayUrls } from '@/config/relays';
import {
  CURATION_ADMIN_PUBKEYS,
  CURATION_SEED_LISTS,
  CURATION_LIST_TITLE,
  CURATION_MAX_VIDEOS,
  type CurationListRef,
} from '@/config/curation';
import { parseVideoListFromEvent } from '@/lib/parseVideoListFromEvent';
import { fetchListVideos } from '@/lib/fetchListVideos';
import { enrichAgeRestrictedVideos } from '@/lib/ageRestrictedVideos';
import { filterShowcaseSafeVideos } from '@/lib/showcaseSafety';
import { shuffle } from '@/lib/shuffle';
import type { NostrEvent } from '@nostrify/nostrify';
import type { ParsedVideoData } from '@/types/video';

const CURATION_LIST_KIND = 30005;

interface MergeOptions {
  adminPubkeys?: string[];
  title?: string;
  seedLists?: CurationListRef[];
}

/**
 * Union the video refs from every qualifying list, newest list first, deduped.
 *
 * A list qualifies when either:
 * - its author is on the admin allowlist AND its title matches (the real
 *   editorial path — a curator names a list `CURATION_LIST_TITLE`), or
 * - it matches a configured seed coordinate (`pubkey:dTag`), used to bootstrap
 *   real content before the titled list exists.
 *
 * Handles both ref kinds: `e` event ids (mobile-authored) and `a` coordinates
 * (web-authored). Lists that qualify under neither rule are ignored even if a
 * relay returns them — we do not trust the relay's filtering.
 */
export function mergeCuratedRefs(events: NostrEvent[], options: MergeOptions = {}): string[] {
  const {
    adminPubkeys = CURATION_ADMIN_PUBKEYS,
    title = CURATION_LIST_TITLE,
    seedLists = CURATION_SEED_LISTS,
  } = options;

  const admins = new Set(adminPubkeys.map(pk => pk.toLowerCase()));
  const seeds = new Set(seedLists.map(l => `${l.pubkey.toLowerCase()}:${l.dTag}`));
  const wantedTitle = title.trim().toLowerCase();

  const qualifying = events
    .map(event => ({ event, list: parseVideoListFromEvent(event) }))
    .filter((entry): entry is { event: NostrEvent; list: NonNullable<typeof entry.list> } => {
      if (!entry.list) return false;
      const author = entry.event.pubkey.toLowerCase();
      const titleMatch = admins.has(author) && entry.list.name.trim().toLowerCase() === wantedTitle;
      const seedMatch = seeds.has(`${author}:${entry.list.id}`);
      return titleMatch || seedMatch;
    })
    .sort((a, b) => b.event.created_at - a.event.created_at);

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const { list } of qualifying) {
    // e-ids and a-coords are distinct namespaces, so a shared Set is safe.
    for (const ref of [...list.videoEventIds, ...list.videoCoordinates]) {
      if (seen.has(ref)) continue;
      seen.add(ref);
      merged.push(ref);
    }
  }
  return merged;
}

export interface CuratedShowcaseResult {
  videos: ParsedVideoData[];
  /** True when no curators and no seed lists are configured — the reel cannot load. */
  isUnconfigured: boolean;
}

/**
 * The curated reel shown on the public homepage.
 *
 * Fails closed at every step: nothing configured, no lists found, or no videos
 * surviving the safety floor all produce an empty reel. There is deliberately no
 * fallback to trending or recent — an uncurated feed is exactly what this
 * surface exists to avoid.
 */
export function useCuratedShowcase() {
  const { nostr } = useNostr();
  const { config } = useAppContext();
  const relayUrls = config.relayUrls || [config.relayUrl];
  const isUnconfigured =
    CURATION_ADMIN_PUBKEYS.length === 0 && CURATION_SEED_LISTS.length === 0;

  const cacheKey = [
    CURATION_ADMIN_PUBKEYS.join(','),
    CURATION_LIST_TITLE,
    CURATION_SEED_LISTS.map(l => `${l.pubkey}:${l.dTag}`).join(','),
  ].join('|');

  const query = useQuery<CuratedShowcaseResult>({
    queryKey: ['curated-showcase', cacheKey, relayUrls.join(',')],
    enabled: !isUnconfigured,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async (context) => {
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(8000)]);
      const relays = getEventLookupRelayUrls({ configuredRelayUrls: relayUrls });

      const listFilters = [];
      // All 30005 lists from allowlisted curators — title-filtered client side,
      // since Nostr can't filter on an arbitrary tag value.
      if (CURATION_ADMIN_PUBKEYS.length > 0) {
        listFilters.push({ kinds: [CURATION_LIST_KIND], authors: CURATION_ADMIN_PUBKEYS });
      }
      // Seed lists addressed by exact author + d tag.
      const seedByAuthor = new Map<string, string[]>();
      for (const list of CURATION_SEED_LISTS) {
        const key = list.pubkey.toLowerCase();
        if (!seedByAuthor.has(key)) seedByAuthor.set(key, []);
        seedByAuthor.get(key)!.push(list.dTag);
      }
      for (const [pubkey, dTags] of seedByAuthor) {
        listFilters.push({ kinds: [CURATION_LIST_KIND], authors: [pubkey], '#d': dTags });
      }

      if (listFilters.length === 0) return { videos: [], isUnconfigured: false };

      const listEvents = await nostr.query(listFilters, { signal, relays });

      const refs = mergeCuratedRefs(listEvents);
      if (refs.length === 0) return { videos: [], isUnconfigured: false };

      const videos = await fetchListVideos(nostr, refs, signal);

      // Resolve the server-side age flag before filtering — the curator may not
      // have known a video was age-gated when they added it. Return the full
      // safe pool; shuffling and the display cap are applied per-mount below.
      const enriched = await enrichAgeRestrictedVideos(videos, signal);

      return {
        videos: filterShowcaseSafeVideos(enriched),
        isUnconfigured: false,
      };
    },
  });

  // Shuffle on every visit, then take the display cap — so each page load shows
  // a fresh random order (and a fresh random subset when the list exceeds the
  // cap). useMemo keys off the fetched pool: a remounted component gets a new
  // instance and reshuffles, while re-renders within a visit stay stable so the
  // reel never reorders mid-scroll.
  const pool = query.data?.videos;
  const videos = useMemo(
    () => shuffle(pool ?? []).slice(0, CURATION_MAX_VIDEOS),
    [pool],
  );

  return {
    ...query,
    videos,
    isUnconfigured,
  };
}
