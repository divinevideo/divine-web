// ABOUTME: Resolve a creator's display name for the showcase caption
// ABOUTME: display_name → name → cached name → deterministic generic fallback

import type { NostrMetadata } from '@nostrify/nostrify';
import { genUserName } from '@/lib/genUserName';

/**
 * Pick the best available display name for a pubkey.
 *
 * Order matters: many profiles put the real name in `display_name` and leave
 * `name` empty, so `display_name` must come first — checking `name` alone was
 * dropping ~half of authors to the generic genUserName. Empty/whitespace values
 * are skipped so a blank `name` doesn't win over a set `display_name`.
 */
export function resolveDisplayName(
  metadata: NostrMetadata | undefined,
  pubkey: string,
  cachedName?: string,
): string {
  return (
    metadata?.display_name?.trim() ||
    metadata?.name?.trim() ||
    cachedName?.trim() ||
    genUserName(pubkey)
  );
}
