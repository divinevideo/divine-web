import { API_CONFIG } from '@/config/api';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { transformFeaturedTabVideosResponse } from '@/lib/featuredTabsTransform';
import type { FunnelcakeResponse } from '@/types/funnelcake';
import type { FeaturedTabsResponse, FeaturedTabVideosResponseRaw } from '@/types/featuredTabs';

function buildUrl(baseUrl: string, endpoint: string, params: Record<string, string | number | undefined> = {}): string {
  const url = new URL(endpoint, baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/**
 * Featured tabs read the shared Funnelcake circuit breaker but never write to
 * it. The breaker is keyed by API host and is what the core feeds — classics,
 * hot, trending, hashtag, profile — use to decide between REST and the relay.
 * Featured is an optional editorial surface with its own last-good grace
 * window, so letting its polls count toward the shared failure threshold would
 * let one non-critical route push every core feed onto the relay. Reading the
 * breaker still keeps featured off a host that is already known to be down.
 */
async function featuredTabsRequest<T>(
  apiUrl: string,
  endpoint: string,
  params: Record<string, string | number | undefined>,
  signal?: AbortSignal
): Promise<T> {
  if (!isFunnelcakeAvailable(apiUrl)) {
    throw new Error('Funnelcake circuit open');
  }

  const timeoutSignal = AbortSignal.timeout(API_CONFIG.funnelcake.timeout);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  const response = await fetch(buildUrl(apiUrl, endpoint, params), {
    signal: combinedSignal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Featured tabs request failed: ${response.status} ${response.statusText}`);
  }

  return await response.json() as T;
}

export function fetchFeaturedTabs(
  apiUrl: string,
  signal?: AbortSignal
): Promise<FeaturedTabsResponse> {
  return featuredTabsRequest<FeaturedTabsResponse>(
    apiUrl,
    '/api/featured-tabs',
    {},
    signal
  );
}

export async function fetchFeaturedTabVideos(
  apiUrl: string,
  id: string,
  cursor: string | undefined,
  limit: number,
  signal?: AbortSignal
): Promise<FunnelcakeResponse> {
  const response = await featuredTabsRequest<FeaturedTabVideosResponseRaw>(
    apiUrl,
    `/api/featured-tabs/${encodeURIComponent(id)}/videos`,
    { cursor, limit },
    signal
  );

  return transformFeaturedTabVideosResponse(response);
}
