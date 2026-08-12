import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchFeaturedTabVideos, fetchFeaturedTabs } from './featuredTabsClient';
import {
  getFunnelcakeStatus,
  isFunnelcakeAvailable,
  recordFunnelcakeFailure,
  resetFunnelcakeCircuit,
} from './funnelcakeHealth';

const API_URL = 'https://api.divine.video';

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const ok = init.ok ?? true;
  return {
    ok,
    status: init.status ?? (ok ? 200 : 500),
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: async () => body,
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetFunnelcakeCircuit(API_URL);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetFunnelcakeCircuit(API_URL);
});

describe('featuredTabsClient', () => {
  it('requests the config endpoint and returns the decoded body', async () => {
    const body = { poll_interval_seconds: 300, featured_tabs: [] };
    fetchMock.mockResolvedValueOnce(jsonResponse(body));

    await expect(fetchFeaturedTabs(API_URL)).resolves.toEqual(body);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.divine.video/api/featured-tabs');
    expect((init as RequestInit).headers).toEqual({ Accept: 'application/json' });
  });

  it('encodes the config id into the videos path and passes cursor and limit', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      data: [],
      pagination: { next_cursor: null, has_more: false },
    }));

    await fetchFeaturedTabVideos(API_URL, 'ft/1234 abcd', 'cursor-2', 12);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.divine.video/api/featured-tabs/ft%2F1234%20abcd/videos?cursor=cursor-2&limit=12'
    );
  });

  it('omits an absent cursor rather than sending an empty one', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      data: [],
      pagination: { next_cursor: null, has_more: false },
    }));

    await fetchFeaturedTabVideos(API_URL, 'ft_1234abcd', undefined, 12);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.divine.video/api/featured-tabs/ft_1234abcd/videos?limit=12'
    );
  });

  it('throws on a non-ok response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 503 }));

    await expect(fetchFeaturedTabs(API_URL)).rejects.toThrow(/503/);
  });

  it('refuses to call the host while the shared circuit is open', async () => {
    for (let i = 0; i < 3; i += 1) {
      recordFunnelcakeFailure(API_URL, 'core feed outage');
    }
    expect(isFunnelcakeAvailable(API_URL)).toBe(false);

    await expect(fetchFeaturedTabs(API_URL)).rejects.toThrow('Funnelcake circuit open');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // The core feeds (classics/hot/trending/hashtag/profile) share one breaker per
  // API host. Featured is an optional surface with its own grace window, so its
  // failures must not be able to push those feeds onto the relay.
  it('does not record featured failures against the shared circuit breaker', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));

    for (let i = 0; i < 5; i += 1) {
      await expect(fetchFeaturedTabs(API_URL)).rejects.toThrow();
    }

    expect(getFunnelcakeStatus(API_URL).errorCount).toBe(0);
    expect(isFunnelcakeAvailable(API_URL)).toBe(true);
  });

  it('does not record featured successes against the shared circuit breaker', async () => {
    recordFunnelcakeFailure(API_URL, 'core feed outage');
    fetchMock.mockResolvedValueOnce(jsonResponse({ poll_interval_seconds: 300, featured_tabs: [] }));

    await fetchFeaturedTabs(API_URL);

    expect(getFunnelcakeStatus(API_URL).errorCount).toBe(1);
  });

  it('propagates an abort from the caller signal', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    fetchMock.mockRejectedValueOnce(abortError);

    const controller = new AbortController();
    await expect(fetchFeaturedTabs(API_URL, controller.signal)).rejects.toBe(abortError);
  });
});
