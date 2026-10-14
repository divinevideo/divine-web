// ABOUTME: Hook to fetch and validate NIP-58 badges for a user profile
// ABOUTME: Subscribes to kinds 10008, 30008, 30009, and 8 to build the full badge chain

import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import {
  BADGE_KINDS,
  parseBadgeDefinition,
  parseProfileBadges,
  selectProfileBadgesEvent,
  validateBadgeAward,
  getCachedDefinition,
  cacheDefinition,
  type ValidatedBadge,
} from '@/lib/badges';

/**
 * Fetch and validate all displayable badges for a given pubkey.
 *
 * Flow:
 * 1. Fetch kind 10008 and legacy kind 30008 (profile_badges) for the user
 * 2. For each badge reference, fetch the kind 30009 definition and kind 8 award
 * 3. Validate the chain: definition → award → user
 * 4. Return only validated badges in display order
 */
/**
 * Shared time budget for the whole badge fan-out (kinds 10008/30008/30009 are
 * addressable, so NPool waits for every relay to EOSE — one hung relay would
 * otherwise block the query forever; same failure mode as issue #415).
 */
const BADGES_QUERY_TIMEOUT_MS = 8000;

function isAbortLikeError(error: unknown): boolean {
  const name = typeof error === 'object' && error !== null && 'name' in error
    ? String(error.name)
    : '';
  return name === 'AbortError' || name === 'TimeoutError';
}

export function useBadges(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<ValidatedBadge[]>({
    queryKey: ['badges', pubkey ?? ''],
    queryFn: async ({ signal: querySignal }) => {
      if (!pubkey || !nostr) return [];

      const signal = AbortSignal.any([querySignal, AbortSignal.timeout(BADGES_QUERY_TIMEOUT_MS)]);

      const profileBadgeFilters: NostrFilter[] = [
        {
          kinds: [BADGE_KINDS.PROFILE_BADGES],
          authors: [pubkey],
          limit: 10,
        },
        {
          kinds: [BADGE_KINDS.PROFILE_BADGES_LEGACY],
          authors: [pubkey],
          '#d': ['profile_badges'],
          limit: 10,
        },
      ];

      let profileBadgeEvents: NostrEvent[] = [];
      try {
        profileBadgeEvents = await nostr.query(
          profileBadgeFilters,
          { signal }
        );
      } catch (error) {
        if (!isAbortLikeError(error)) throw error;
        return [];
      }

      const profileBadgeEvent = selectProfileBadgesEvent(profileBadgeEvents);

      // Fallback: if no profile badges event exists in either encoding, show all awarded badges
      if (!profileBadgeEvent) {
        // Fetch all badge awards for this user
        const awardFilter: NostrFilter = {
          kinds: [BADGE_KINDS.AWARD],
          '#p': [pubkey],
          limit: 20,
        };
        let awards: NostrEvent[] = [];
        try {
          awards = await nostr.query([awardFilter], { signal });
        } catch (error) {
          if (!isAbortLikeError(error)) throw error;
          return [];
        }
        if (!awards.length) return [];

        // For each award, extract the badge definition reference and fetch it
        const fallbackValidated: ValidatedBadge[] = [];
        for (const award of awards) {
          const aTag = award.tags.find(t => t[0] === 'a');
          if (!aTag) continue;
          const naddr = aTag[1]; // e.g. "30009:<pubkey>:beta-tester"
          const parts = naddr.split(':');
          if (parts.length < 3) continue;

          let def = getCachedDefinition(naddr);
          if (!def) {
            try {
              const defEvents = await nostr.query([{
                kinds: [BADGE_KINDS.DEFINITION],
                authors: [parts[1]],
                '#d': [parts[2]],
              }], { signal });
              for (const ev of defEvents) {
                const parsed = parseBadgeDefinition(ev);
                if (parsed) {
                  cacheDefinition(parsed);
                  def = parsed;
                }
              }
            } catch { /* continue */ }
          }

          if (def && validateBadgeAward(award, def, pubkey)) {
            fallbackValidated.push({
              definition: def,
              awardEvent: award,
              awardedAt: award.created_at,
            });
          }
        }
        return fallbackValidated;
      }

      const badgeRefs = parseProfileBadges(profileBadgeEvent);
      if (!badgeRefs.length) return [];

      // Step 2: Fetch all needed definitions and awards in parallel
      const validated: ValidatedBadge[] = [];

      // Batch-fetch definitions we don't have cached
      const uncachedNaddrs = badgeRefs
        .filter(ref => !getCachedDefinition(ref.naddr))
        .map(ref => {
          const parts = ref.naddr.split(':');
          return { author: parts[1], dTag: parts[2] };
        })
        .filter(p => p.author && p.dTag);

      // Fetch definitions
      if (uncachedNaddrs.length > 0) {
        // Group by author for efficient queries
        const byAuthor = new Map<string, string[]>();
        for (const { author, dTag } of uncachedNaddrs) {
          const existing = byAuthor.get(author) || [];
          existing.push(dTag);
          byAuthor.set(author, existing);
        }

        const defFilters: NostrFilter[] = Array.from(byAuthor.entries()).map(
          ([author, dTags]) => ({
            kinds: [BADGE_KINDS.DEFINITION],
            authors: [author],
            '#d': dTags,
          })
        );

        for (const filter of defFilters) {
          try {
            const defEvents = await nostr.query(
              [filter],
              { signal }
            );
            for (const ev of defEvents) {
              const def = parseBadgeDefinition(ev);
              if (def) cacheDefinition(def);
            }
          } catch {
            // Continue with what we have
          }
        }
      }

      // Fetch award events
      const awardIds = badgeRefs.map(ref => ref.awardId).filter(Boolean);
      let awardEvents: NostrEvent[] = [];
      if (awardIds.length > 0) {
        try {
          awardEvents = await nostr.query(
            [{ kinds: [BADGE_KINDS.AWARD], ids: awardIds }],
            { signal }
          );
        } catch {
          // Continue without awards - they won't validate
        }
      }

      const awardMap = new Map(awardEvents.map(ev => [ev.id, ev]));

      // Step 3: Validate each badge
      for (const ref of badgeRefs) {
        const def = getCachedDefinition(ref.naddr);
        if (!def) continue;

        const award = awardMap.get(ref.awardId);
        if (!award) continue;

        if (validateBadgeAward(award, def, pubkey)) {
          validated.push({
            definition: def,
            awardEvent: award,
            awardedAt: award.created_at,
          });
        }
      }

      return validated;
    },
    enabled: !!pubkey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
