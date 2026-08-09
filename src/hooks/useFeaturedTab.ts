import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getFunnelcakeBaseUrl } from '@/config/api';
import { useProtectedMinorStatus } from '@/hooks/useProtectedMinorStatus';
import { fetchFeaturedTabs } from '@/lib/featuredTabsClient';
import { selectFeaturedTab } from '@/lib/featuredTabEligibility';
import type { FeaturedTabsResponse, ResolvedFeaturedTab } from '@/types/featuredTabs';

const MIN_REFETCH_INTERVAL_MS = 30 * 1000;
const DEFAULT_REFETCH_INTERVAL_MS = 5 * 60 * 1000;
// The last-good config is bounded so an editorial kill switch still takes
// effect when the config endpoint is down. The bound has to leave room for the
// poll itself: at exactly one interval a render can land before the in-flight
// refresh resolves, drop the tab, and bounce a reader off the tab they are on.
const STALE_CONFIG_GRACE_INTERVALS = 2;
const GC_TIME_MS = 30 * 60 * 1000;

let lastGoodConfig: {
  apiUrl: string;
  response: FeaturedTabsResponse;
  refreshedAt: number;
} | null = null;

function getRefetchIntervalMs(response: FeaturedTabsResponse | undefined): number {
  const seconds = response?.poll_interval_seconds;
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) {
    return DEFAULT_REFETCH_INTERVAL_MS;
  }

  return Math.max(MIN_REFETCH_INTERVAL_MS, seconds * 1000);
}

function getFreshCachedConfig(apiUrl: string, now: number): FeaturedTabsResponse | null {
  if (!lastGoodConfig || lastGoodConfig.apiUrl !== apiUrl) return null;

  const maxAgeMs = getRefetchIntervalMs(lastGoodConfig.response) * STALE_CONFIG_GRACE_INTERVALS;
  return now - lastGoodConfig.refreshedAt <= maxAgeMs
    ? lastGoodConfig.response
    : null;
}

export function clearFeaturedTabCacheForTests(): void {
  lastGoodConfig = null;
}

export function useFeaturedTab(): ResolvedFeaturedTab | null {
  const apiUrl = getFunnelcakeBaseUrl();
  const { i18n } = useTranslation();
  const minorStatus = useProtectedMinorStatus();

  useQuery({
    queryKey: ['featured-tabs', apiUrl],
    queryFn: async ({ signal }) => {
      const response = await fetchFeaturedTabs(apiUrl, signal);
      lastGoodConfig = {
        apiUrl,
        response,
        refreshedAt: Date.now(),
      };
      return response;
    },
    staleTime: 60 * 1000,
    gcTime: GC_TIME_MS,
    refetchOnWindowFocus: true,
    refetchInterval: (queryState) => getRefetchIntervalMs(queryState.state.data),
  });

  const response = getFreshCachedConfig(apiUrl, Date.now());

  return useMemo(() => {
    if (!response) return null;

    return selectFeaturedTab(response.featured_tabs, {
      now: new Date(),
      minorState: minorStatus.state,
      locale: i18n.language,
    });
  }, [i18n.language, minorStatus.state, response]);
}
