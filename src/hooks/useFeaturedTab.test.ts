import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FeaturedTabsResponse } from '@/types/featuredTabs';

const mockFetchFeaturedTabs = vi.fn();
let minorState: 'protected' | 'not_protected' | 'unknown' = 'not_protected';
let language = 'es-MX';
let apiUrl = 'https://api.divine.video';

vi.mock('@/lib/featuredTabsClient', () => ({
  fetchFeaturedTabs: mockFetchFeaturedTabs,
}));

vi.mock('@/config/api', () => ({
  getFunnelcakeBaseUrl: () => apiUrl,
}));

vi.mock('@/hooks/useProtectedMinorStatus', () => ({
  useProtectedMinorStatus: () => ({
    state: minorState,
    isKnown: minorState !== 'unknown',
    verifiedMinorAt: null,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language },
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function makeResponse(overrides: Partial<FeaturedTabsResponse['featured_tabs'][number]> = {}): FeaturedTabsResponse {
  return {
    poll_interval_seconds: 300,
    featured_tabs: [
      {
        id: 'ft_1234abcd',
        slug: 'seasonal-theme',
        label: { default: 'Seasonal', es: 'Especial' },
        position: { web: { after: 'hot' } },
        starts_at: '2026-08-01T00:00:00Z',
        ends_at: '2026-09-01T00:00:00Z',
        enabled: true,
        visible_to_minors: true,
        disclosure_label: null,
        has_content: true,
        ...overrides,
      },
    ],
  };
}

async function flushQuery(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

let useFeaturedTab: typeof import('./useFeaturedTab').useFeaturedTab;
let clearFeaturedTabCacheForTests: typeof import('./useFeaturedTab').clearFeaturedTabCacheForTests;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-08T12:00:00Z'));
  vi.clearAllMocks();
  minorState = 'not_protected';
  language = 'es-MX';
  apiUrl = 'https://api.divine.video';

  const hook = await import('./useFeaturedTab');
  useFeaturedTab = hook.useFeaturedTab;
  clearFeaturedTabCacheForTests = hook.clearFeaturedTabCacheForTests;
  clearFeaturedTabCacheForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFeaturedTab', () => {
  it('returns null when Funnelcake serves no featured configuration', async () => {
    mockFetchFeaturedTabs.mockResolvedValueOnce({
      poll_interval_seconds: 300,
      featured_tabs: [],
    });

    const { result } = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    await flushQuery();

    expect(mockFetchFeaturedTabs).toHaveBeenCalled();
    expect(result.current.tab).toBeNull();
  });

  it('resolves an eligible localized featured tab', async () => {
    mockFetchFeaturedTabs.mockResolvedValueOnce(makeResponse());

    const { result } = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    await flushQuery();

    expect(result.current.tab).toEqual({
      id: 'ft_1234abcd',
      slug: 'seasonal-theme',
      label: 'Especial',
      position: { after: 'hot' },
      disclosureLabel: null,
    });
  });

  it('uses a fresh last-good config through one transient refresh failure', async () => {
    mockFetchFeaturedTabs.mockResolvedValueOnce(makeResponse());
    const first = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    await flushQuery();
    expect(first.result.current.tab?.id).toBe('ft_1234abcd');
    first.unmount();

    mockFetchFeaturedTabs.mockRejectedValueOnce(new Error('temporary outage'));
    const second = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    expect(second.result.current.tab?.id).toBe('ft_1234abcd');
  });

  it('keeps the last-good config across the poll boundary and drops it after the grace window', async () => {
    mockFetchFeaturedTabs.mockResolvedValueOnce(makeResponse());
    const first = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    await flushQuery();
    expect(first.result.current.tab?.id).toBe('ft_1234abcd');
    first.unmount();

    // One poll interval (300s) has elapsed and the refresh is still in flight:
    // dropping the tab here would bounce a reader off the tab they are on.
    vi.setSystemTime(new Date('2026-08-08T12:05:01Z'));
    mockFetchFeaturedTabs.mockRejectedValueOnce(new Error('temporary outage'));
    const second = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });
    expect(second.result.current.tab?.id).toBe('ft_1234abcd');
    second.unmount();

    // Past the poll interval plus its grace: the kill switch takes effect.
    vi.setSystemTime(new Date('2026-08-08T12:10:01Z'));
    mockFetchFeaturedTabs.mockRejectedValueOnce(new Error('sustained outage'));
    const third = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    expect(third.result.current.tab).toBeNull();
  });

  it('ignores a cached config that belongs to a different Funnelcake host', async () => {
    mockFetchFeaturedTabs.mockResolvedValueOnce(makeResponse());
    const first = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    await flushQuery();
    expect(first.result.current.tab?.id).toBe('ft_1234abcd');
    first.unmount();

    apiUrl = 'https://relay.staging.dvines.org';
    mockFetchFeaturedTabs.mockRejectedValueOnce(new Error('staging outage'));
    const second = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    expect(second.result.current.tab).toBeNull();
  });

  it('clamps a hostile poll interval so it cannot extend the kill switch', async () => {
    // Without an upper clamp the grace window is a function of this number, so
    // a config endpoint could keep a killed tab on screen indefinitely.
    mockFetchFeaturedTabs.mockResolvedValueOnce({
      ...makeResponse(),
      poll_interval_seconds: 86400,
    });
    const first = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    await flushQuery();
    expect(first.result.current.tab?.id).toBe('ft_1234abcd');
    first.unmount();

    // 20 minutes: past the 15 minute clamp plus its grace, well inside 24 hours.
    vi.setSystemTime(new Date('2026-08-08T12:20:00Z'));
    mockFetchFeaturedTabs.mockRejectedValueOnce(new Error('sustained outage'));
    const second = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    expect(second.result.current.tab).toBeNull();
  });

  it('re-checks the editorial window against the clock, not the response identity', async () => {
    mockFetchFeaturedTabs.mockResolvedValueOnce(makeResponse({
      ends_at: '2026-08-08T12:02:00Z',
    }));
    const { result, rerender } = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    await flushQuery();
    expect(result.current.tab?.id).toBe('ft_1234abcd');

    // Same cached response object, later clock: ends_at has passed.
    vi.setSystemTime(new Date('2026-08-08T12:03:00Z'));
    rerender();

    expect(result.current.tab).toBeNull();
  });

  it('reports the configuration as unresolved until the first request settles', async () => {
    let release: (value: unknown) => void = () => {};
    mockFetchFeaturedTabs.mockImplementationOnce(() => new Promise((resolve) => {
      release = resolve;
    }));

    const { result } = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    expect(result.current.isResolved).toBe(false);

    await act(async () => {
      release(makeResponse());
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isResolved).toBe(true);
    expect(result.current.tab?.id).toBe('ft_1234abcd');
  });

  it('hides minor-restricted tabs when protected-minor status is unknown', async () => {
    minorState = 'unknown';
    mockFetchFeaturedTabs.mockResolvedValueOnce(makeResponse({ visible_to_minors: false }));

    const { result } = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    await flushQuery();

    expect(mockFetchFeaturedTabs).toHaveBeenCalled();
    expect(result.current.tab).toBeNull();
  });
});
