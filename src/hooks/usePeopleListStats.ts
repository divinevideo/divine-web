// src/hooks/usePeopleListStats.ts
import { useQuery } from '@tanstack/react-query';
import { usePeopleList } from './usePeopleList';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { fetchBulkUsers } from '@/lib/funnelcakeClient';
import { API_CONFIG } from '@/config/api';

const MAX_AGGREGATE_MEMBERS = 200;

export interface PeopleListStats {
  members: number;
  videos: number | null;  // null = unknown (too many members or REST unhealthy)
  loops: number | null;   // always null in v1; aggregation deferred
}

export function usePeopleListStats(pubkey: string | undefined, dTag: string | undefined) {
  const list = usePeopleList(pubkey, dTag);
  const memberPubkeys = list.data?.members ?? [];
  const apiUrl = API_CONFIG.funnelcake.baseUrl;
  const restOk = isFunnelcakeAvailable(apiUrl);
  const tooMany = memberPubkeys.length > MAX_AGGREGATE_MEMBERS;
  const useFetch = list.isSuccess && memberPubkeys.length > 0 && !tooMany && restOk;

  return useQuery<PeopleListStats>({
    queryKey: ['people-list-stats', pubkey, dTag, memberPubkeys.length, restOk],
    enabled: list.isSuccess,
    queryFn: async ({ signal }) => {
      if (!useFetch) {
        return { members: memberPubkeys.length, videos: null, loops: null };
      }
      const response = await fetchBulkUsers(apiUrl, memberPubkeys, signal);
      let videos = 0;
      for (const u of response.users) videos += u.stats?.video_count ?? 0;
      return { members: memberPubkeys.length, videos, loops: null };
    },
    staleTime: 5 * 60_000,
  });
}
