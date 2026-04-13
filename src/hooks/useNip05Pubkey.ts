// ABOUTME: React Query hook that resolves a NIP-05 identifier to a hex pubkey
// ABOUTME: via the standard .well-known/nostr.json endpoint.

import { useQuery } from '@tanstack/react-query';
import { resolveNip05ToPubkey } from '@/lib/nip05Resolve';

export function useNip05Pubkey(nip05: string | undefined) {
  return useQuery({
    queryKey: ['nip05-pubkey', nip05?.toLowerCase()],
    queryFn: async ({ signal }) => {
      if (!nip05) return null;
      return resolveNip05ToPubkey(nip05, { signal });
    },
    enabled: !!nip05 && nip05.includes('@'),
    staleTime: 300_000,
    gcTime: 900_000,
    retry: false,
  });
}
