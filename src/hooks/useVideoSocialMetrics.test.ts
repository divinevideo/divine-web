import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchVideoStats = vi.fn();
const mockIsFunnelcakeAvailable = vi.fn();

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: vi.fn(),
    },
  }),
}));

vi.mock('@/config/api', () => ({
  getFunnelcakeBaseUrl: () => 'https://api.divine.video',
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: {
      relayUrl: 'wss://relay.divine.video',
    },
  }),
}));

vi.mock('@/config/relays', () => ({
  getFunnelcakeUrl: () => 'https://api.divine.video',
  hasFunnelcake: () => true,
}));

vi.mock('@/lib/funnelcakeClient', () => ({
  fetchVideoStats: mockFetchVideoStats,
}));

vi.mock('@/lib/funnelcakeHealth', () => ({
  isFunnelcakeAvailable: mockIsFunnelcakeAvailable,
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
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

describe('useVideoSocialMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFunnelcakeAvailable.mockReturnValue(true);
  });

  it('returns loop totals separately from view starts', async () => {
    mockFetchVideoStats.mockResolvedValueOnce({
      event_id: 'video-1',
      reactions: 7,
      comments: 6,
      reposts: 2,
      views: 23,
      loops: 11,
      trending_score: 0,
      engagement_score: 25,
    });

    const { useVideoSocialMetrics } = await import('./useVideoSocialMetrics');

    const { result } = renderHook(
      () => useVideoSocialMetrics('video-1', 'pubkey-1', 'd-tag-1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.viewCount).toBe(23);
    expect(result.current.data?.loopCount).toBe(11);
  });
});
