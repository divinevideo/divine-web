import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { RelayCapabilities } from '@/lib/relayCapabilities';

const mockUseInfiniteVideos = vi.fn();
const mockUseInfiniteVideosFunnelcake = vi.fn();
const mockUseResolvedRelayCapabilities = vi.fn();

let relayUrl = 'wss://relay.divine.video';

const queryResult = {
  data: undefined,
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};

function makeCapabilities(overrides: Partial<RelayCapabilities> = {}): RelayCapabilities {
  return {
    url: relayUrl,
    supportsNIP50: true,
    supportsSearch: true,
    supportsVideoSorts: true,
    supportsCategoryFeed: false,
    supportedSortModes: ['hot', 'top', 'rising', 'controversial'],
    detectedAt: Date.now(),
    source: 'optimistic',
    ...overrides,
  };
}

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: { relayUrl },
  }),
}));

vi.mock('@/hooks/useInfiniteVideos', () => ({
  useInfiniteVideos: mockUseInfiniteVideos,
}));

vi.mock('@/hooks/useInfiniteVideosFunnelcake', () => ({
  useInfiniteVideosFunnelcake: mockUseInfiniteVideosFunnelcake,
}));

vi.mock('@/hooks/useRelayCapabilities', () => ({
  useResolvedRelayCapabilities: mockUseResolvedRelayCapabilities,
}));

vi.mock('@/config/relays', async () => {
  const actual = await vi.importActual<typeof import('@/config/relays')>('@/config/relays');
  return actual;
});

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

let useVideoProvider: typeof import('./useVideoProvider').useVideoProvider;
let chooseVideoDataSource: typeof import('./useVideoProvider').chooseVideoDataSource;
let canServeFeedViaWebsocket: typeof import('./useVideoProvider').canServeFeedViaWebsocket;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  relayUrl = 'wss://relay.divine.video';

  mockUseInfiniteVideos.mockReturnValue(queryResult);
  mockUseInfiniteVideosFunnelcake.mockReturnValue(queryResult);
  mockUseResolvedRelayCapabilities.mockReturnValue(makeCapabilities());

  const hook = await import('./useVideoProvider');
  useVideoProvider = hook.useVideoProvider;
  chooseVideoDataSource = hook.chooseVideoDataSource;
  canServeFeedViaWebsocket = hook.canServeFeedViaWebsocket;
});

describe('chooseVideoDataSource', () => {
  it('keeps category feeds on canonical Funnelcake', () => {
    relayUrl = 'wss://relay.damus.io';

    const decision = chooseVideoDataSource({
      feedType: 'category',
      relayUrl,
      relayCapabilities: makeCapabilities({
        url: relayUrl,
        supportsNIP50: false,
        supportsSearch: false,
        supportsVideoSorts: false,
        supportedSortModes: [],
      }),
    });

    expect(decision).toEqual(expect.objectContaining({
      dataSource: 'funnelcake',
      apiUrl: 'https://api.divine.video',
      reason: 'prefer-canonical-funnelcake-rest-api',
    }));
  });

  it('prefers Funnelcake for hot feeds even when the selected relay supports video sorting', () => {
    const decision = chooseVideoDataSource({
      feedType: 'trending',
      sortMode: 'hot',
      relayUrl: 'wss://relay.divine.video',
      relayCapabilities: makeCapabilities({ supportsVideoSorts: true }),
    });

    expect(decision).toEqual(expect.objectContaining({
      dataSource: 'funnelcake',
      apiUrl: 'https://api.divine.video',
      websocketFeedType: 'trending',
      reason: 'prefer-selected-relay-funnelcake-rest-api',
    }));
  });

  it('falls back to canonical Funnelcake for hot feeds on relays without video-sort support', () => {
    relayUrl = 'wss://relay.ditto.pub';

    const decision = chooseVideoDataSource({
      feedType: 'trending',
      sortMode: 'hot',
      relayUrl,
      relayCapabilities: makeCapabilities({
        url: relayUrl,
        supportsVideoSorts: false,
        supportedSortModes: [],
      }),
    });

    expect(decision).toEqual(expect.objectContaining({
      dataSource: 'funnelcake',
      apiUrl: 'https://api.divine.video',
      reason: 'prefer-canonical-funnelcake-rest-api',
    }));
  });
});

describe('canServeFeedViaWebsocket', () => {
  it('rejects unsupported category feeds', () => {
    expect(canServeFeedViaWebsocket('category', 'hot', makeCapabilities())).toBe(false);
  });

  it('allows profile feeds even when relay-side video sorting is unavailable', () => {
    expect(canServeFeedViaWebsocket('profile', 'hot', makeCapabilities({
      supportsVideoSorts: false,
      supportedSortModes: [],
    }))).toBe(true);
  });
});

describe('useVideoProvider', () => {
  it('routes category feeds away from the WebSocket hook', () => {
    relayUrl = 'wss://relay.damus.io';
    mockUseResolvedRelayCapabilities.mockReturnValue(makeCapabilities({
      url: relayUrl,
      supportsNIP50: false,
      supportsSearch: false,
      supportsVideoSorts: false,
      supportedSortModes: [],
    }));

    const { result } = renderHook(() =>
      useVideoProvider({
        feedType: 'category',
        category: 'dance',
      })
    );

    expect(mockUseInfiniteVideosFunnelcake).toHaveBeenCalledWith(expect.objectContaining({
      feedType: 'category',
      apiUrl: 'https://api.divine.video',
      category: 'dance',
      enabled: true,
    }));
    expect(mockUseInfiniteVideos).toHaveBeenCalledWith(expect.objectContaining({
      enabled: false,
    }));
    expect(result.current.dataSource).toBe('funnelcake');
  });

  it('prefers Funnelcake for Divine hot feeds', () => {
    mockUseResolvedRelayCapabilities.mockReturnValue(makeCapabilities({
      supportsVideoSorts: true,
    }));

    const { result } = renderHook(() =>
      useVideoProvider({
        feedType: 'trending',
        sortMode: 'hot',
      })
    );

    expect(mockUseInfiniteVideosFunnelcake).toHaveBeenCalledWith(expect.objectContaining({
      feedType: 'trending',
      apiUrl: 'https://api.divine.video',
      sortMode: 'trending',
      enabled: true,
    }));
    expect(mockUseInfiniteVideos).toHaveBeenCalledWith(expect.objectContaining({
      feedType: 'trending',
      sortMode: 'hot',
      enabled: false,
    }));
    expect(result.current.dataSource).toBe('funnelcake');
  });

  it('uses canonical Funnelcake for profile feeds on non-Divine relays', () => {
    relayUrl = 'wss://relay.damus.io';
    mockUseResolvedRelayCapabilities.mockReturnValue(makeCapabilities({
      url: relayUrl,
      supportsNIP50: false,
      supportsSearch: false,
      supportsVideoSorts: false,
      supportedSortModes: [],
    }));

    const { result } = renderHook(() =>
      useVideoProvider({
        feedType: 'profile',
        pubkey: 'a'.repeat(64),
        sortMode: 'hot',
      })
    );

    expect(mockUseInfiniteVideosFunnelcake).toHaveBeenCalledWith(expect.objectContaining({
      feedType: 'profile',
      apiUrl: 'https://api.divine.video',
      pubkey: 'a'.repeat(64),
      enabled: true,
    }));
    expect(mockUseInfiniteVideos).toHaveBeenCalledWith(expect.objectContaining({
      feedType: 'profile',
      pubkey: 'a'.repeat(64),
      sortMode: 'hot',
      enabled: false,
    }));
    expect(result.current.dataSource).toBe('funnelcake');
  });

  it('falls back to WebSocket after a Funnelcake failure when the relay can serve the feed', () => {
    mockUseInfiniteVideosFunnelcake.mockReturnValue({
      ...queryResult,
      error: new Error('rest failed'),
    });

    const { result } = renderHook(() =>
      useVideoProvider({
        feedType: 'recent',
      })
    );

    expect(mockUseInfiniteVideosFunnelcake).toHaveBeenCalledWith(expect.objectContaining({
      feedType: 'recent',
      apiUrl: 'https://api.divine.video',
      enabled: true,
    }));
    expect(mockUseInfiniteVideos).toHaveBeenCalledWith(expect.objectContaining({
      feedType: 'recent',
      enabled: true,
    }));
    expect(result.current.dataSource).toBe('websocket');
  });
});
