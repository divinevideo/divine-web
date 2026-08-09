import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getFunnelcakeBaseUrl } from '@/config/api';
import { useProtectedMinorStatus } from '@/hooks/useProtectedMinorStatus';
import { fetchFeaturedTabs } from '@/lib/featuredTabsClient';
import { selectFeaturedTab } from '@/lib/featuredTabEligibility';
import type { FeaturedTabsResponse, ResolvedFeaturedTab } from '@/types/featuredTabs';

const MIN_REFETCH_INTERVAL_MS = 30 * 1000;
const DEFAULT_REFETCH_INTERVAL_MS = 5 * 60 * 1000;
// The poll cadence is server-supplied, so it is clamped at both ends. Without an
// upper bound a misconfigured or hostile config response could set a very large
// interval and, because the grace window below is derived from it, keep a killed
// tab on screen for as long as it liked.
const MAX_REFETCH_INTERVAL_MS = 15 * 60 * 1000;
// Grace past one poll before the last-good config is dropped. At exactly one
// interval a render can land before the in-flight refresh resolves, drop the
// tab, and bounce a reader off the tab they are reading.
const STALE_CONFIG_GRACE_MS = 60 * 1000;
const GC_TIME_MS = 30 * 60 * 1000;

export interface FeaturedTabState {
  tab: ResolvedFeaturedTab | null;
  /**
   * Whether the featured configuration is known, either from a settled request
   * or from a still-fresh last-good response. Callers that redirect on an
   * unknown Discovery slug must wait for this: before it is true, `tab: null`
   * only means "not loaded yet", and treating it as "no such tab" would break
   * a deep link to a perfectly valid featured slug.
   */
  isResolved: boolean;
}

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

  return Math.min(
    MAX_REFETCH_INTERVAL_MS,
    Math.max(MIN_REFETCH_INTERVAL_MS, seconds * 1000)
  );
}

function getFreshCachedConfig(apiUrl: string, now: number): FeaturedTabsResponse | null {
  if (!lastGoodConfig || lastGoodConfig.apiUrl !== apiUrl) return null;

  const maxAgeMs = getRefetchIntervalMs(lastGoodConfig.response) + STALE_CONFIG_GRACE_MS;
  return now - lastGoodConfig.refreshedAt <= maxAgeMs
    ? lastGoodConfig.response
    : null;
}

function isSameResolvedTab(
  a: ResolvedFeaturedTab | null,
  b: ResolvedFeaturedTab | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  return a.id === b.id
    && a.slug === b.slug
    && a.label === b.label
    && a.disclosureLabel === b.disclosureLabel
    && a.position?.after === b.position?.after
    && a.position?.before === b.position?.before;
}

export function clearFeaturedTabCacheForTests(): void {
  lastGoodConfig = null;
}

export function useFeaturedTab(): FeaturedTabState {
  const apiUrl = getFunnelcakeBaseUrl();
  const { i18n } = useTranslation();
  const minorStatus = useProtectedMinorStatus();
  const lastResolved = useRef<ResolvedFeaturedTab | null>(null);

  const { isSuccess } = useQuery({
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

  // Deliberately not memoized on the response identity: `starts_at` / `ends_at`
  // are evaluated against the current time, and a memo keyed on the response
  // would hold a decision taken before the editorial window opened or closed
  // until the next successful poll replaced the object. Selection is a scan of
  // a short list, so it runs per render and the reference is stabilised below
  // to keep consumers' effects and memos from churning.
  const resolved = response
    ? selectFeaturedTab(response.featured_tabs, {
        now: new Date(),
        minorState: minorStatus.state,
        locale: i18n.language,
      })
    : null;

  if (!isSameResolvedTab(lastResolved.current, resolved)) {
    lastResolved.current = resolved;
  }

  return {
    tab: lastResolved.current,
    // A failed request is not an answer. `isError` deliberately does not count:
    // without a config in hand we do not know whether a given slug names a live
    // featured tab, and a caller that redirected on it would throw away a valid
    // shared link during a config outage. Unknown stays unknown.
    isResolved: isSuccess || response !== null,
  };
}
