// ABOUTME: Single source of truth for turning profile metadata into a display name.
// ABOUTME: Treats empty and whitespace-only values as absent - Funnelcake returns name: "" widely.

import type { NostrMetadata } from '@nostrify/nostrify';

import { genUserName } from '@/lib/genUserName';

/** Returns the trimmed value, or undefined when it is absent, empty, or whitespace-only. */
function presentValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/**
 * Resolve the name to show for a pubkey.
 * Prefers display_name, then name, then a deterministic generated name.
 * Never returns an empty string.
 *
 * Display-only. Do not use where the raw name/handle is wanted: if the string is
 * about to be prefixed with `@`, it is a handle, not a display name.
 */
export function resolveDisplayName(
  metadata: Pick<NostrMetadata, 'display_name' | 'name'> | undefined,
  pubkey: string,
): string {
  return presentValue(metadata?.display_name)
    ?? presentValue(metadata?.name)
    ?? genUserName(pubkey);
}
