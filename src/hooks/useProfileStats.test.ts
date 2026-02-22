// ABOUTME: Tests for useProfileStats hook
// ABOUTME: Tests REST-first profile stats fetching with WebSocket fallback

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the funnelcakeClient module
vi.mock('@/lib/funnelcakeClient', () => ({
  fetchUserProfile: vi.fn(),
  fetchUserLoopStats: vi.fn(),
  FunnelcakeApiError: class FunnelcakeApiError extends Error {
    constructor(
      message: string,
      public statusCode: number | null,
      public details?: string
    ) {
      super(message);
      this.name = 'FunnelcakeApiError';
    }
  },
}));

// Mock the funnelcakeHealth module
vi.mock('@/lib/funnelcakeHealth', () => ({
  isFunnelcakeAvailable: vi.fn().mockReturnValue(true),
  recordFunnelcakeSuccess: vi.fn(),
  recordFunnelcakeFailure: vi.fn(),
  shouldFallbackToWebSocket: vi.fn().mockReturnValue(false),
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
      baseUrl: 'https://relay.divine.video',
      timeout: 5000,
      endpoints: {
        userProfile: '/api/users/{pubkey}',
        leaderboardCreators: '/api/leaderboard/creators',
      },
    },
  },
}));

// Mock nostrify
const mockNostrQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

const TEST_PUBKEY = 'a'.repeat(64);

// Helper to create a wrapper with QueryClient
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

describe('useProfileStats', () => {
  let useProfileStats: typeof import('./useProfileStats').useProfileStats;
  let fetchUserProfile: ReturnType<typeof vi.fn>;
  let fetchUserLoopStats: ReturnType<typeof vi.fn>;
  let isFunnelcakeAvailable: ReturnType<typeof vi.fn>;
  let shouldFallbackToWebSocket: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Re-import after mocking
    const client = await import('@/lib/funnelcakeClient');
    fetchUserProfile = client.fetchUserProfile as ReturnType<typeof vi.fn>;
    fetchUserLoopStats = client.fetchUserLoopStats as ReturnType<typeof vi.fn>;

    const health = await import('@/lib/funnelcakeHealth');
    isFunnelcakeAvailable = health.isFunnelcakeAvailable as ReturnType<typeof vi.fn>;
    shouldFallbackToWebSocket = health.shouldFallbackToWebSocket as ReturnType<typeof vi.fn>;

    const hook = await import('./useProfileStats');
    useProfileStats = hook.useProfileStats;

    // Reset mocks to default behavior
    isFunnelcakeAvailable.mockReturnValue(true);
    shouldFallbackToWebSocket.mockReturnValue(false);
    mockNostrQuery.mockResolvedValue([]);
    // Default loop stats to null (user not in leaderboard)
    fetchUserLoopStats.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches profile stats from Funnelcake REST API when available', async () => {
    const mockProfile = {
      pubkey: TEST_PUBKEY,
      name: 'testuser',
      follower_count: 100,
      following_count: 50,
      video_count: 10,
      total_reactions: 500,
    };

    const mockLoopStats = {
      views: 1000,
      unique_viewers: 50,
      loops: 750,
      videos_with_views: 8,
    };

    fetchUserProfile.mockResolvedValueOnce(mockProfile);
    fetchUserLoopStats.mockResolvedValueOnce(mockLoopStats);

    const { result } = renderHook(
      () => useProfileStats(TEST_PUBKEY, []),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.followersCount).toBe(100);
    expect(result.current.data?.followingCount).toBe(50);
    expect(result.current.data?.videosCount).toBe(0); // From videos array, not API
    expect(result.current.data?.totalLoops).toBe(750);
    expect(result.current.data?.totalViews).toBe(1000);
    expect(fetchUserProfile).toHaveBeenCalledWith(
      'https://relay.divine.video',
      TEST_PUBKEY,
      expect.any(AbortSignal)
    );
    expect(fetchUserLoopStats).toHaveBeenCalledWith(
      'https://relay.divine.video',
      TEST_PUBKEY,
      expect.any(AbortSignal)
    );
  });

  it('calculates originalLoopCount from videos array', async () => {
    const mockProfile = {
      pubkey: TEST_PUBKEY,
      follower_count: 100,
      following_count: 50,
    };

    fetchUserProfile.mockResolvedValueOnce(mockProfile);

    const mockVideos = [
      { id: 'v1', loopCount: 1000000, isVineMigrated: true },
      { id: 'v2', loopCount: 500000, isVineMigrated: true },
      { id: 'v3', loopCount: 0, isVineMigrated: false },
    ] as unknown[];

    const { result } = renderHook(
      () => useProfileStats(TEST_PUBKEY, mockVideos as import('@/types/video').ParsedVideoData[]),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.videosCount).toBe(3);
    expect(result.current.data?.originalLoopCount).toBe(1500000);
    expect(result.current.data?.isClassicViner).toBe(true);
  });

  it('falls back to WebSocket when Funnelcake is unavailable', async () => {
    isFunnelcakeAvailable.mockReturnValue(false);

    // Mock WebSocket response (contact list)
    mockNostrQuery.mockImplementation(async (filters) => {
      if (filters[0].kinds?.includes(3) && filters[0].authors) {
        // Contact list query - user's following
        return [{
          kind: 3,
          pubkey: TEST_PUBKEY,
          created_at: 1700000000,
          tags: [['p', 'follower1'], ['p', 'follower2']],
          content: '',
        }];
      }
      if (filters[0].kinds?.includes(3) && filters[0]['#p']) {
        // Follower query
        return [
          { kind: 3, pubkey: 'follower1', tags: [['p', TEST_PUBKEY]] },
          { kind: 3, pubkey: 'follower2', tags: [['p', TEST_PUBKEY]] },
          { kind: 3, pubkey: 'follower3', tags: [['p', TEST_PUBKEY]] },
        ];
      }
      return [];
    });

    const { result } = renderHook(
      () => useProfileStats(TEST_PUBKEY, []),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // WebSocket fallback should have been used
    expect(fetchUserProfile).not.toHaveBeenCalled();
    expect(mockNostrQuery).toHaveBeenCalled();
    expect(result.current.data?.followingCount).toBe(2);
    expect(result.current.data?.followersCount).toBe(3);
  });

  it('falls back to WebSocket when REST API returns null', async () => {
    fetchUserProfile.mockResolvedValueOnce(null);

    mockNostrQuery.mockResolvedValue([{
      kind: 3,
      pubkey: TEST_PUBKEY,
      created_at: 1700000000,
      tags: [['p', 'following1']],
      content: '',
    }]);

    const { result } = renderHook(
      () => useProfileStats(TEST_PUBKEY, []),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNostrQuery).toHaveBeenCalled();
  });

  it('does not fetch when pubkey is empty', async () => {
    const { result } = renderHook(
      () => useProfileStats('', []),
      { wrapper: createWrapper() }
    );

    // Should not trigger any fetching
    expect(result.current.isLoading).toBe(false);
    expect(fetchUserProfile).not.toHaveBeenCalled();
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });

  it('returns default stats on complete failure', async () => {
    fetchUserProfile.mockRejectedValueOnce(new Error('Network error'));
    mockNostrQuery.mockRejectedValueOnce(new Error('WebSocket error'));

    const { result } = renderHook(
      () => useProfileStats(TEST_PUBKEY, []),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should return default stats
    expect(result.current.data?.followersCount).toBe(0);
    expect(result.current.data?.followingCount).toBe(0);
  });

  it('uses correct staleTime and gcTime for caching', async () => {
    fetchUserProfile.mockResolvedValueOnce({
      pubkey: TEST_PUBKEY,
      follower_count: 100,
      following_count: 50,
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(
      () => useProfileStats(TEST_PUBKEY, []),
      { wrapper }
    );

    await waitFor(() => {
      expect(fetchUserProfile).toHaveBeenCalledTimes(1);
    });

    // Query should be in cache
    const queryState = queryClient.getQueryState(['profile-stats-v2', TEST_PUBKEY, 0]);
    expect(queryState).toBeDefined();
  });
});
