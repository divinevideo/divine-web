// ABOUTME: NIP-58 badge utilities - validation, parsing, and caching
// ABOUTME: Handles badge definitions (kind 30009), awards (kind 8), and profile badges (kind 30008)

import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Divine's official badge-issuing pubkey.
 * Badges from this pubkey get gold "official" styling.
 */
export const DIVINE_BADGE_PUBKEY = 'b3a706bcceb39f193da553ce76255dd6ba5b097001c8ef85ff1b92e994894c81';

/** NIP-58 event kinds */
export const BADGE_KINDS = {
  DEFINITION: 30009,
  AWARD: 8,
  PROFILE_BADGES: 30008,
} as const;

/** Parsed badge definition from a kind 30009 event */
export interface BadgeDefinition {
  /** The `d` tag identifier */
  dTag: string;
  /** Human-readable name */
  name: string;
  /** Description text */
  description: string;
  /** Full-size image URL */
  image?: string;
  /** Thumbnail URLs keyed by size (e.g. "256x256") */
  thumbs: Record<string, string>;
  /** Pubkey of the issuer */
  issuerPubkey: string;
  /** NIP-33 address: `30009:<pubkey>:<d-tag>` */
  naddr: string;
  /** Whether this is from Divine's official pubkey */
  isOfficial: boolean;
  /** The raw event */
  event: NostrEvent;
}

/** A validated badge that a user can display */
export interface ValidatedBadge {
  definition: BadgeDefinition;
  /** The kind 8 award event */
  awardEvent: NostrEvent;
  /** When the award was created (unix timestamp) */
  awardedAt: number;
}

/**
 * Parse a kind 30009 event into a BadgeDefinition
 */
export function parseBadgeDefinition(event: NostrEvent): BadgeDefinition | null {
  if (event.kind !== BADGE_KINDS.DEFINITION) return null;

  const dTag = event.tags.find(t => t[0] === 'd')?.[1];
  if (!dTag) return null;

  const name = event.tags.find(t => t[0] === 'name')?.[1] || dTag;
  const description = event.tags.find(t => t[0] === 'description')?.[1] || '';
  const imageTag = event.tags.find(t => t[0] === 'image');
  const image = imageTag?.[1];

  const thumbs: Record<string, string> = {};
  for (const tag of event.tags) {
    if (tag[0] === 'thumb' && tag[1]) {
      const size = tag[2] || 'default';
      thumbs[size] = tag[1];
    }
  }

  const naddr = `30009:${event.pubkey}:${dTag}`;

  return {
    dTag,
    name,
    description,
    image,
    thumbs,
    issuerPubkey: event.pubkey,
    naddr,
    isOfficial: event.pubkey === DIVINE_BADGE_PUBKEY,
    event,
  };
}

/**
 * Get the best thumbnail URL for a given target size.
 * Falls back to the full image if no suitable thumb exists.
 */
export function getBadgeImageUrl(def: BadgeDefinition, targetSize: number): string | undefined {
  // Try exact match first
  const exact = def.thumbs[`${targetSize}x${targetSize}`];
  if (exact) return exact;

  // Find closest thumb
  const sizes = Object.keys(def.thumbs)
    .map(s => {
      const match = s.match(/^(\d+)/);
      return match ? { size: parseInt(match[1], 10), url: def.thumbs[s] } : null;
    })
    .filter(Boolean) as { size: number; url: string }[];

  if (sizes.length > 0) {
    // Pick the smallest thumb >= targetSize, or the largest available
    sizes.sort((a, b) => a.size - b.size);
    const suitable = sizes.find(s => s.size >= targetSize);
    return suitable?.url || sizes[sizes.length - 1].url;
  }

  return def.image;
}

/**
 * Parse `a` tags from a kind 30008 profile badges event.
 * Returns pairs of [naddr, awardEventId] in display order.
 */
export function parseProfileBadges(event: NostrEvent): Array<{ naddr: string; awardId: string }> {
  if (event.kind !== BADGE_KINDS.PROFILE_BADGES) return [];

  const results: Array<{ naddr: string; awardId: string }> = [];
  const tags = event.tags;

  // Profile badges use alternating a/e tag pairs after the d tag
  for (let i = 0; i < tags.length; i++) {
    if (tags[i][0] === 'a' && tags[i][1]) {
      // Look for the next e tag
      const nextE = tags.find((t, j) => j > i && t[0] === 'e');
      if (nextE?.[1]) {
        results.push({
          naddr: tags[i][1],
          awardId: nextE[1],
        });
      }
    }
  }

  return results;
}

/**
 * Validate that a kind 8 award event correctly awards a badge to a user.
 *
 * Checks:
 * 1. Award was signed by the same pubkey as the badge definition
 * 2. Award contains the user's pubkey in a `p` tag
 * 3. Award references the correct badge definition in an `a` tag
 */
export function validateBadgeAward(
  awardEvent: NostrEvent,
  definition: BadgeDefinition,
  userPubkey: string
): boolean {
  if (awardEvent.kind !== BADGE_KINDS.AWARD) return false;

  // 1. Award must be from the same issuer as the definition
  if (awardEvent.pubkey !== definition.issuerPubkey) return false;

  // 2. User must be in a `p` tag
  const hasUser = awardEvent.tags.some(
    t => t[0] === 'p' && t[1] === userPubkey
  );
  if (!hasUser) return false;

  // 3. Award must reference the correct badge definition
  const hasDefinition = awardEvent.tags.some(
    t => t[0] === 'a' && t[1] === definition.naddr
  );
  if (!hasDefinition) return false;

  return true;
}

// In-memory cache for badge definitions (they rarely change)
const definitionCache = new Map<string, { def: BadgeDefinition; cachedAt: number }>();
const DEFINITION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function getCachedDefinition(naddr: string): BadgeDefinition | null {
  const cached = definitionCache.get(naddr);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > DEFINITION_CACHE_TTL) {
    definitionCache.delete(naddr);
    return null;
  }
  return cached.def;
}

export function cacheDefinition(def: BadgeDefinition): void {
  definitionCache.set(def.naddr, { def, cachedAt: Date.now() });
}
