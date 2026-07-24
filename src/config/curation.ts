// ABOUTME: Configuration for the hand-curated all-ages showcase reel
// ABOUTME: The web renders a titled kind 30005 list from allowlisted curators

const HEX_PUBKEY_PATTERN = /^[0-9a-f]{64}$/i;

export interface CurationListRef {
  /** Curator pubkey, hex. */
  pubkey: string;
  /** The list's `d` tag. The mobile app auto-generates these as `list_<ms>`. */
  dTag: string;
}

/**
 * The exact title a curator gives their showcase list.
 *
 * We match on title, not `d` tag, because the mobile app auto-generates the
 * `d` tag (`list_<ms>`) and never lets a human choose it — but the title is
 * fully editable. A curator on the allowlist below creates a public list with
 * this exact title (case-insensitive) and it becomes the reel.
 *
 * Overridable via `VITE_CURATION_LIST_TITLE`.
 */
export const CURATION_LIST_TITLE =
  import.meta.env.VITE_CURATION_LIST_TITLE || 'divine-web';

/**
 * Pubkeys whose titled showcase list the web will render, in hex.
 *
 * Curation happens in the mobile app — the web is read-only. Only a list from
 * a pubkey in this set, with the exact title above, is shown; a list from
 * anyone else, or the same person under a different title, is ignored. This is
 * the trust boundary: guessing the title is not enough.
 *
 * Configure via `VITE_CURATION_ADMINS` (comma-separated hex) or edit
 * `DEFAULT_CURATION_ADMIN_PUBKEYS`.
 */
const DEFAULT_CURATION_ADMIN_PUBKEYS: string[] = [
  // Liz Sweigart
  '0edc2f474484769bc9bf6d471d180e4e280b0bcd719b6da791001beb730cff1b',
];

/**
 * Optional explicit lists to render regardless of title, addressed by
 * `pubkey:dTag`. Was used to seed the reel before the real titled list existed;
 * now empty because Liz's public `divine-web` list is live and matched by title.
 *
 * Overridable via `VITE_CURATION_LISTS` (comma-separated `pubkey:dTag`).
 */
const DEFAULT_CURATION_SEED_LISTS: CurationListRef[] = [];

export function parseCurationAdmins(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const entry of raw.split(',')) {
    const pubkey = entry.trim().toLowerCase();
    if (HEX_PUBKEY_PATTERN.test(pubkey)) seen.add(pubkey);
  }
  return [...seen];
}

/**
 * Parse `VITE_CURATION_LISTS` — comma-separated `pubkey:dTag` entries.
 * The pubkey must be 64-char hex; the d tag is the remainder after the first
 * colon (d tags never contain a colon in the mobile scheme).
 */
export function parseCurationLists(raw: string | undefined): CurationListRef[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const lists: CurationListRef[] = [];
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    const firstColon = trimmed.indexOf(':');
    if (firstColon === -1) continue;
    const pubkey = trimmed.slice(0, firstColon).toLowerCase();
    const dTag = trimmed.slice(firstColon + 1);
    if (!HEX_PUBKEY_PATTERN.test(pubkey) || !dTag) continue;
    const key = `${pubkey}:${dTag}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lists.push({ pubkey, dTag });
  }
  return lists;
}

const envAdmins = parseCurationAdmins(import.meta.env.VITE_CURATION_ADMINS);
const envSeed = parseCurationLists(import.meta.env.VITE_CURATION_LISTS);

export const CURATION_ADMIN_PUBKEYS: string[] =
  envAdmins.length > 0 ? envAdmins : DEFAULT_CURATION_ADMIN_PUBKEYS;

export const CURATION_SEED_LISTS: CurationListRef[] =
  envSeed.length > 0 ? envSeed : DEFAULT_CURATION_SEED_LISTS;

/** Cap on how many videos the showcase renders, regardless of list length. */
export const CURATION_MAX_VIDEOS = 24;
