import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchSupporter, updateSupporterRecognition, type SupporterRecognition } from '@/lib/supportersClient';

export function useSupporter() {
  const { user, signer, isHostedAccount, isResolvingJwt } = useCurrentUser();
  const queryClient = useQueryClient();
  const pubkey = user?.pubkey;
  const canAutoRefresh = !!signer && (isHostedAccount || (!!user && 'method' in user && user.method === 'nsec'));
  const query = useQuery({
    queryKey: ['supporter', pubkey],
    queryFn: ({ signal }) => {
      if (!pubkey || !signer) throw new Error('Sign in to check supporter status');
      return fetchSupporter(signer, pubkey, signal);
    },
    enabled: !!pubkey && canAutoRefresh,
    staleTime: 60_000,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: canAutoRefresh ? 'always' : false,
    refetchOnReconnect: canAutoRefresh,
  });
  const mutation = useMutation({
    mutationFn: async (recognition: SupporterRecognition) => {
      if (!pubkey || !signer) throw new Error('Sign in to change recognition');
      await queryClient.cancelQueries({ queryKey: ['supporter', pubkey] });
      const snapshot = await updateSupporterRecognition(signer, pubkey, recognition);
      queryClient.setQueryData(['supporter', pubkey], snapshot);
      await queryClient.invalidateQueries({ queryKey: ['public-supporter', pubkey] });
    },
  });
  return {
    ...query,
    isActive: !query.isError && !!query.data?.entitlement.isActive && ['active', 'grace'].includes(query.data.status),
    canAutoRefresh,
    isSignedIn: !!pubkey || isResolvingJwt,
    canCheck: !!pubkey && !!signer,
    updateRecognition: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
