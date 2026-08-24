import type { NostrMetadata } from '@nostrify/nostrify';

import { genUserName } from '@/lib/genUserName';

function presentValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function resolveDisplayName(
  metadata: Pick<NostrMetadata, 'display_name' | 'name'> | undefined,
  pubkey: string,
): string {
  return presentValue(metadata?.display_name)
    ?? presentValue(metadata?.name)
    ?? genUserName(pubkey);
}
