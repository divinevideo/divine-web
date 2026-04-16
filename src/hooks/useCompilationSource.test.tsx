import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUseInfiniteSearchVideos = vi.fn();
const mockUseVideoProvider = vi.fn();

vi.mock('@/hooks/useInfiniteSearchVideos', () => ({
  useInfiniteSearchVideos: mockUseInfiniteSearchVideos,
}));

vi.mock('@/hooks/useVideoProvider', () => ({
  useVideoProvider: mockUseVideoProvider,
}));

let useCompilationSource: typeof import('./useCompilationSource').useCompilationSource;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  mockUseInfiniteSearchVideos.mockReturnValue({
    data: {
      pages: [{ videos: [{ id: 'search-video', pubkey: 'p1' }] }],
    },
    fetchNextPage: vi.fn(),
    hasNextPage: true,
    isLoading: false,
    error: null,
  });

  mockUseVideoProvider.mockReturnValue({
    data: {
      pages: [{ videos: [{ id: 'feed-video', pubkey: 'p2' }] }],
    },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isLoading: false,
    error: null,
    dataSource: 'funnelcake',
  });

  ({ useCompilationSource } = await import('./useCompilationSource'));
});

describe('useCompilationSource', () => {
  it('uses search pagination for search descriptors', () => {
    const { result } = renderHook(() =>
      useCompilationSource({
        source: 'search',
        query: 'twerking',
        filter: 'videos',
        sort: 'relevance',
      })
    );

    expect(mockUseInfiniteSearchVideos).toHaveBeenCalledWith({
      query: 'twerking',
      sortMode: 'relevance',
      pageSize: 12,
    });
    expect(result.current.kind).toBe('search');
    expect(result.current.videos).toEqual([{ id: 'search-video', pubkey: 'p1' }]);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('uses feed pagination for classics descriptors', () => {
    const { result } = renderHook(() =>
      useCompilationSource({
        source: 'classics',
        sort: 'top',
      })
    );

    expect(mockUseVideoProvider).toHaveBeenCalledWith({
      feedType: 'classics',
      sortMode: 'top',
      hashtag: undefined,
      category: undefined,
      pubkey: undefined,
      pageSize: 12,
      enabled: true,
    });
    expect(result.current.kind).toBe('feed');
    expect(result.current.videos).toEqual([{ id: 'feed-video', pubkey: 'p2' }]);
    expect(result.current.hasNextPage).toBe(false);
  });
});
