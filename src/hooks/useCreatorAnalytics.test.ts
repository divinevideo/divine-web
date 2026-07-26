// ABOUTME: Tests for useCreatorAnalytics hook
// ABOUTME: Verifies Funnelcake profile failures keep a single Sentry signal (#467)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the funnelcakeClient module
vi.mock('@/lib/funnelcakeClient', () => ({
  fetchUserProfile: vi.fn(),
  fetchUserVideos: vi.fn(),
  fetchBulkVideoStats: vi.fn(),
}));

// Mock the funnelcakeHealth module
vi.mock('@/lib/funnelcakeHealth', () => ({
  isFunnelcakeAvailable: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/funnelcakeFallbackReporting', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/funnelcakeFallbackReporting')>()),
  reportFunnelcakeFallback: vi.fn(),
}));

vi.mock('@/lib/analyticsTransform', () => ({
  buildAnalyticsData: vi.fn().mockReturnValue({}),
}));

// Mock the debug module
vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

// Mock the API config
vi.mock('@/config/api', () => ({
  API_CONFIG: {
    funnelcake: {
      baseUrl: 'https://api.divine.video',
      timeout: 5000,
      endpoints: {
        userProfile: '/api/users/{pubkey}',
        userVideos: '/api/users/{pubkey}/videos',
        videoStatsBulk: '/api/videos/stats/bulk',
      },
    },
  },
}));

const TEST_PUBKEY = 'a'.repeat(64);

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

describe('useCreatorAnalytics', () => {
  let useCreatorAnalytics: typeof import('./useCreatorAnalytics').useCreatorAnalytics;
  let fetchUserProfile: ReturnType<typeof vi.fn>;
  let fetchUserVideos: ReturnType<typeof vi.fn>;
  let fetchBulkVideoStats: ReturnType<typeof vi.fn>;
  let reportFunnelcakeFallback: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const client = await import('@/lib/funnelcakeClient');
    fetchUserProfile = client.fetchUserProfile as ReturnType<typeof vi.fn>;
    fetchUserVideos = client.fetchUserVideos as ReturnType<typeof vi.fn>;
    fetchBulkVideoStats = client.fetchBulkVideoStats as ReturnType<typeof vi.fn>;

    const fallbackReporting = await import('@/lib/funnelcakeFallbackReporting');
    reportFunnelcakeFallback = fallbackReporting.reportFunnelcakeFallback as ReturnType<typeof vi.fn>;

    const hook = await import('./useCreatorAnalytics');
    useCreatorAnalytics = hook.useCreatorAnalytics;

    // Default: empty video list, no stats needed
    fetchUserVideos.mockResolvedValue({ videos: [], has_more: false });
    fetchBulkVideoStats.mockResolvedValue({ stats: [], missing: [] });
  });

  it('reports a fallback when the profile fetch returns null', async () => {
    // fetchUserProfile swallows request errors and returns null (#467)
    fetchUserProfile.mockResolvedValue(null);

    const { result } = renderHook(() => useCreatorAnalytics(TEST_PUBKEY), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(reportFunnelcakeFallback).toHaveBeenCalledWith(expect.objectContaining({
      source: 'useCreatorAnalytics',
      apiUrl: 'https://api.divine.video',
      reason: 'REST returned no profile',
      context: { pubkey: TEST_PUBKEY },
    }));
  });

  it('does not report a fallback when the profile fetch succeeds', async () => {
    fetchUserProfile.mockResolvedValue({
      pubkey: TEST_PUBKEY,
      name: 'testuser',
      follower_count: 100,
    });

    const { result } = renderHook(() => useCreatorAnalytics(TEST_PUBKEY), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(reportFunnelcakeFallback).not.toHaveBeenCalled();
  });
});
