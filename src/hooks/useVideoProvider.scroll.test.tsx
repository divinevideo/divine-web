import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useInfiniteQuery } from '@tanstack/react-query';
import InfiniteScroll from 'react-infinite-scroll-component';
import { useVideoProvider } from './useVideoProvider';

const { fetchPage, blocked } = vi.hoisted(() => ({ fetchPage: vi.fn(), blocked: new Set<string>() }));
vi.mock('@/hooks/useAppContext', () => ({ useAppContext: () => ({ config: { relayUrl: 'wss://relay.divine.video' } }) }));
vi.mock('@/hooks/useRelayCapabilities', () => ({ useResolvedRelayCapabilities: () => ({ supportsNIP50: true, supportsSearch: true, supportsVideoSorts: true, supportedSortModes: ['hot'] }) }));
vi.mock('@/hooks/useFeedBlocklist', () => ({ useFeedBlocklist: () => blocked }));
vi.mock('@/hooks/useInfiniteVideos', () => ({ useInfiniteVideos: () => ({ data: undefined }) }));
vi.mock('@/hooks/useFeaturedTabVideos', () => ({ useFeaturedTabVideos: () => ({ data: undefined }) }));
vi.mock('@/hooks/useInfiniteVideosFunnelcake', () => ({
  useInfiniteVideosFunnelcake: function useInfiniteVideosFunnelcake() {
    return useInfiniteQuery({
      queryKey: ['provider-real-scroll'], initialPageParam: 0,
      queryFn: ({ pageParam, signal }) => fetchPage(pageParam, signal),
      getNextPageParam: (page: { next?: number }) => page.next,
      staleTime: 0,
    });
  },
}));

function PagingHarness() {
  const provider = useVideoProvider({ feedType: 'recent' });
  return <InfiniteScroll dataLength={provider.fetchedCount} next={provider.fetchNextPage}
    hasMore={!!provider.hasNextPage} height={300} loader={<span>Loading</span>}>
    <span data-testid="row-count">{provider.fetchedCount}</span>
  </InfiniteScroll>;
}

describe('provider paging through a real scroll event', () => {
  let client: QueryClient;
  beforeEach(() => {
    fetchPage.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => client.clear());

  it('fetches a new page instead of joining an equal-sized background refresh', async () => {
    let background = false;
    let backgroundSignal: AbortSignal | undefined;
    fetchPage.mockImplementation((page: number, signal: AbortSignal) => {
      if (page === 0 && background) {
        backgroundSignal = signal;
        return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
      }
      return Promise.resolve({
        videos: [{ id: `row-${page}`, pubkey: 'a'.repeat(64), kind: 34236, vineId: `row-${page}` }],
        next: page === 0 ? 1 : undefined,
      });
    });
    const { container } = render(<QueryClientProvider client={client}><PagingHarness /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByTestId('row-count')).toHaveTextContent('1'));
    background = true;
    let refresh: Promise<void>;
    act(() => { refresh = client.refetchQueries({ queryKey: ['provider-real-scroll'] }); });
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    const scroll = container.querySelector('.infinite-scroll-component');
    if (!scroll) throw new Error('Expected real InfiniteScroll element');
    Object.defineProperties(scroll, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 600 },
      scrollTop: { configurable: true, value: 300 },
    });
    fireEvent.scroll(scroll);
    await waitFor(() => expect(fetchPage).toHaveBeenCalledWith(1, expect.any(AbortSignal)));
    await waitFor(() => expect(screen.getByTestId('row-count')).toHaveTextContent('2'));
    expect(backgroundSignal?.aborted).toBe(true);
    await refresh!;
  });
});
