import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FeaturedTabsResponse } from '@/types/featuredTabs';

const mockFetchFeaturedTabs = vi.fn();
let minorState: 'protected' | 'not_protected' | 'unknown' = 'not_protected';
let language = 'es-MX';

vi.mock('@/lib/featuredTabsClient', () => ({
  fetchFeaturedTabs: mockFetchFeaturedTabs,
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
    expect(result.current).toBeNull();
  });

  it('resolves an eligible localized featured tab', async () => {
    mockFetchFeaturedTabs.mockResolvedValueOnce(makeResponse());

    const { result } = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    await flushQuery();

    expect(result.current).toEqual({
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
    expect(first.result.current?.id).toBe('ft_1234abcd');
    first.unmount();

    mockFetchFeaturedTabs.mockRejectedValueOnce(new Error('temporary outage'));
    const second = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    expect(second.result.current?.id).toBe('ft_1234abcd');
  });

  it('drops the last-good config after the 5 minute TTL', async () => {
    mockFetchFeaturedTabs.mockResolvedValueOnce(makeResponse());
    const first = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    await flushQuery();
    expect(first.result.current?.id).toBe('ft_1234abcd');
    first.unmount();

    vi.setSystemTime(new Date('2026-08-08T12:05:01Z'));
    mockFetchFeaturedTabs.mockRejectedValueOnce(new Error('sustained outage'));
    const second = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    expect(second.result.current).toBeNull();
  });

  it('hides minor-restricted tabs when protected-minor status is unknown', async () => {
    minorState = 'unknown';
    mockFetchFeaturedTabs.mockResolvedValueOnce(makeResponse({ visible_to_minors: false }));

    const { result } = renderHook(() => useFeaturedTab(), { wrapper: createWrapper() });

    await flushQuery();

    expect(mockFetchFeaturedTabs).toHaveBeenCalled();
    expect(result.current).toBeNull();
  });
});
