// ABOUTME: Resolves the Divine moderation pubkey via NIP-05 (moderation@divine.video)
// ABOUTME: Falls back to a known pubkey if NIP-05 resolution fails

import { useQuery } from '@tanstack/react-query';

const MODERATION_NIP05_NAME = 'moderation';
const MODERATION_NIP05_DOMAIN = 'divine.video';

/** Fallback pubkey if NIP-05 resolution fails */
const MODERATION_PUBKEY_FALLBACK =
  '8fd5eb6d8f362163bc00a5ab6b4a3167dbf32d00ec4efdbcf43b3c9514433b7e';

async function resolveModerationPubkey(): Promise<string> {
  const url = `https://${MODERATION_NIP05_DOMAIN}/.well-known/nostr.json?name=${MODERATION_NIP05_NAME}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) return MODERATION_PUBKEY_FALLBACK;

  const data = (await response.json()) as { names?: Record<string, string> };
  const pubkey = data?.names?.[MODERATION_NIP05_NAME];

  if (typeof pubkey === 'string' && /^[0-9a-f]{64}$/.test(pubkey)) {
    return pubkey;
  }

  return MODERATION_PUBKEY_FALLBACK;
}

export function useModerationPubkey(): string {
  const { data } = useQuery({
    queryKey: ['moderation-pubkey-nip05'],
    queryFn: resolveModerationPubkey,
    staleTime: 3600000, // 1 hour
    gcTime: 86400000, // 24 hours
    retry: false,
    placeholderData: MODERATION_PUBKEY_FALLBACK,
  });

  return data ?? MODERATION_PUBKEY_FALLBACK;
}

/** For non-hook contexts that need a synchronous fallback */
export { MODERATION_PUBKEY_FALLBACK as DIVINE_MODERATION_PUBKEY };
