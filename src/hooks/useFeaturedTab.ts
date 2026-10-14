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

function getFreshCachedConfig(
  response: FeaturedTabsResponse | undefined,
  refreshedAt: number,
  now: number
): FeaturedTabsResponse | null {
  if (!response || !refreshedAt) return null;

  const maxAgeMs = getRefetchIntervalMs(response) + STALE_CONFIG_GRACE_MS;
  return now - refreshedAt <= maxAgeMs
    ? response
    : null;
}

export function useFeaturedTab({
  apiUrl = getFunnelcakeBaseUrl(),
  enabled = true,
}: {
  apiUrl?: string;
  enabled?: boolean;
} = {}): FeaturedTabState {
  const { i18n } = useTranslation();
  const minorStatus = useProtectedMinorStatus();

  const { data, dataUpdatedAt } = useQuery({
    queryKey: ['featured-tabs', apiUrl],
    queryFn: ({ signal }) => fetchFeaturedTabs(apiUrl, signal),
    enabled,
    staleTime: 60 * 1000,
    gcTime: GC_TIME_MS,
    refetchOnWindowFocus: true,
    refetchInterval: (queryState) => getRefetchIntervalMs(queryState.state.data),
  });

  const response = getFreshCachedConfig(data, dataUpdatedAt, Date.now());

  // Deliberately not memoized on the response identity: `starts_at` / `ends_at`
  // are evaluated against the current time, and a memo keyed on the response
  // would hold a decision taken before the editorial window opened or closed
  // until the next successful poll replaced the object. Selection is a scan of
  // a short list, so it runs per render.
  const resolved = response
    ? selectFeaturedTab(response.featured_tabs, {
        now: new Date(),
        minorState: minorStatus.state,
        locale: i18n.language,
      })
    : null;

  return {
    tab: resolved,
    // A failed request is not an answer. `isError` deliberately does not count:
    // without a config in hand we do not know whether a given slug names a live
    // featured tab, and a caller that redirected on it would throw away a valid
    // shared link during a config outage. Unknown stays unknown.
    isResolved: response !== null,
  };
}
