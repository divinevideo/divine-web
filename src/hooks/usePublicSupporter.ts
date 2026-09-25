import { useQuery } from '@tanstack/react-query';
import { fetchPublicSupporter } from '@/lib/supportersClient';

export function usePublicSupporter(pubkey: string) {
  return useQuery({
    queryKey: ['public-supporter', pubkey],
    queryFn: ({ signal }) => fetchPublicSupporter(pubkey, signal),
    enabled: /^[0-9a-f]{64}$/.test(pubkey),
    staleTime: 60_000,
    retry: false,
  });
}
