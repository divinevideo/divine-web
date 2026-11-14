import { queryOptions } from '@tanstack/react-query';

import { parseNip05, resolveNip05ToPubkey } from '@/lib/nip05Resolve';

export const NIP05_STALE_TIME_MS = 300_000;

export function nip05QueryOptions(nip05: string | undefined) {
  const parsed = nip05 ? parseNip05(nip05) : null;
  const normalized = parsed ? `${parsed.name}@${parsed.domain.toLowerCase()}` : nip05?.trim();
  return queryOptions({
    queryKey: ['nip05-pubkey', normalized],
    queryFn: ({ signal }) => parsed && normalized
      ? resolveNip05ToPubkey(normalized, { signal })
      : Promise.resolve(null),
    enabled: !!nip05,
    staleTime: NIP05_STALE_TIME_MS,
    gcTime: 900_000,
    retry: false,
  });
}
