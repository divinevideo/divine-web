import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getFunnelcakeBaseUrl } from '@/config/api';
import { useProtectedMinorStatus } from '@/hooks/useProtectedMinorStatus';
import { fetchFeaturedTabs } from '@/lib/featuredTabsClient';
import { selectFeaturedTab } from '@/lib/featuredTabEligibility';
import type { FeaturedTabsResponse, ResolvedFeaturedTab } from '@/types/featuredTabs';

const FEATURED_TAB_CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_REFETCH_INTERVAL_MS = 30 * 1000;
const DEFAULT_REFETCH_INTERVAL_MS = 5 * 60 * 1000;

let lastGoodConfig: { response: FeaturedTabsResponse; refreshedAt: number } | null = null;

function getFreshCachedConfig(now: number): FeaturedTabsResponse | null {
  if (!lastGoodConfig) return null;
  return now - lastGoodConfig.refreshedAt <= FEATURED_TAB_CACHE_TTL_MS
    ? lastGoodConfig.response
    : null;
}

function getRefetchIntervalMs(response: FeaturedTabsResponse | undefined): number {
  const seconds = response?.poll_interval_seconds;
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) {
    return DEFAULT_REFETCH_INTERVAL_MS;
  }

  return Math.max(MIN_REFETCH_INTERVAL_MS, seconds * 1000);
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
        response,
        refreshedAt: Date.now(),
      };
      return response;
    },
    staleTime: 60 * 1000,
    gcTime: FEATURED_TAB_CACHE_TTL_MS,
    refetchOnWindowFocus: true,
    refetchInterval: (queryState) => getRefetchIntervalMs(queryState.state.data),
  });

  const response = getFreshCachedConfig(Date.now());

  return useMemo(() => {
    if (!response) return null;

    return selectFeaturedTab(response.featured_tabs, {
      now: new Date(),
      minorState: minorStatus.state,
      locale: i18n.language,
    });
  }, [i18n.language, minorStatus.state, response]);
}
