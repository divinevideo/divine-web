import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchUserCollabs } from '@/lib/funnelcakeClient';

export function useMyConfirmedCollabs() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ['user-collabs', user?.pubkey],
    enabled: !!user?.pubkey,
    staleTime: 60_000,
    queryFn: ({ signal }) => fetchUserCollabs(user!.pubkey, { signal }),
  });
}
