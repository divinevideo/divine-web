import { API_CONFIG } from '@/config/api';
import { isFunnelcakeAvailable, recordFunnelcakeFailure, recordFunnelcakeSuccess } from '@/lib/funnelcakeHealth';
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

function isAbortRequestError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { name?: unknown }).name === 'AbortError';
}

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

  try {
    const response = await fetch(buildUrl(apiUrl, endpoint, params), {
      signal: combinedSignal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Featured tabs request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    recordFunnelcakeSuccess(apiUrl);
    return data as T;
  } catch (err) {
    if (isAbortRequestError(err)) throw err;

    const message = err instanceof Error ? err.message : 'Unknown featured tabs error';
    recordFunnelcakeFailure(apiUrl, message);
    throw err;
  }
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
