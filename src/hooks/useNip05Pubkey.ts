import { useQuery } from '@tanstack/react-query';

import { nip05QueryOptions } from '@/lib/nip05Query';

export function useNip05Pubkey(nip05: string | undefined) {
  return useQuery({
    ...nip05QueryOptions(nip05),
    enabled: !!nip05 && nip05.includes('@'),
  });
}
