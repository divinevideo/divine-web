import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { VideoPage } from './VideoPage';
import { useProtectedMinorStatus } from '@/hooks/useProtectedMinorStatus';
import { useAgeRestrictedPreference } from '@/hooks/useAgeRestrictedPreference';
import { initializeI18n } from '@/lib/i18n';

const { videos, mounts } = vi.hoisted(() => ({
  videos: [1, 2, 3].map(index => ({
    id: `video-${index}`, pubkey: 'a'.repeat(64), kind: 34236, createdAt: index,
    content: `video ${index}`, videoUrl: `https://example.com/${index}.mp4`,
    vineId: `v${index}`, hashtags: [], reposts: [], isVineMigrated: false,
  })),
  mounts: [] as string[],
}));
vi.mock('@unhead/react', () => ({ useSeoMeta: vi.fn(), useHead: vi.fn() }));
vi.mock('@/hooks/useDivineSession', () => ({ useDivineSession: () => ({ session: { token: 'test-hosted-session' } }) }));
vi.mock('@/hooks/useSubdomainNavigate', () => ({ useSubdomainNavigate: () => vi.fn() }));
vi.mock('@/hooks/useVideoByIdFunnelcake', () => ({
  useVideoByIdFunnelcake: function useVideoByIdFunnelcake() {
    useProtectedMinorStatus();
    return { video: videos[0], videos, isLoading: false, error: null, windowOffset: 0,
      fetchedCount: 3, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(),
      featuredNavigationState: 'not-featured', featuredTab: null };
  },
}));
vi.mock('@/hooks/useVideoNavigation', async () => ({
  ...await vi.importActual<typeof import('@/hooks/useVideoNavigation')>('@/hooks/useVideoNavigation'),
  useVideoNavigation: () => ({ videos: null, currentVideo: null, isLoading: false }),
}));
vi.mock('@/hooks/useAuthor', () => ({ useAuthor: () => ({ data: { metadata: { name: 'Example' } } }) }));
vi.mock('@/hooks/useBatchedVideoInteractions', () => ({ useBatchedVideoInteractions: () => ({ interactions: new Map() }) }));
vi.mock('@/hooks/useNostrPublish', () => ({ useNostrPublish: () => ({ mutateAsync: vi.fn() }) }));
vi.mock('@/hooks/usePublishVideo', () => ({ useRepostVideo: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { pubkey: 'b'.repeat(64) } }) }));
vi.mock('@/hooks/useVideoSocialMetrics', () => ({ useVideoSocialMetrics: () => ({ data: null }) }));
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/LoginDialogContext', () => ({ useLoginDialog: () => ({ openLoginDialog: vi.fn() }) }));
vi.mock('@/components/VideoCard', () => ({
  VideoCard: function VideoCard({ video }: { video: { id: string } }) {
    useProtectedMinorStatus();
    useEffect(() => { mounts.push(video.id); }, [video.id]);
    return <div data-testid={video.id}>{video.id}</div>;
  },
}));

describe('VideoPage hosted-session and storage lifecycle', () => {
  let client: QueryClient;
  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    mounts.length = 0;
    await initializeI18n({ force: true, languages: ['en-US'] });
    Element.prototype.scrollIntoView = vi.fn();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => {
    client.clear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function renderHostedPage() {
    const fetchMock = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return { ok: true, json: async () => ({ verified_minor: false }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/video/video-1?source=search&q=loops&index=0']}>
      <Routes><Route path="/video/:id" element={<VideoPage />} /></Routes>
    </MemoryRouter></QueryClientProvider>);
    return fetchMock;
  }

  it('settles real account queries instead of repeatedly mounting card observers', async () => {
    const fetchMock = renderHostedPage();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    const settledCount = fetchMock.mock.calls.length;
    const settledMounts = mounts.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(fetchMock).toHaveBeenCalledTimes(settledCount);
    expect(mounts).toHaveLength(settledMounts);
    expect(settledCount).toBeLessThanOrEqual(3);
    expect(settledMounts).toBe(3);
  });

  it('preserves current card identity on discovery, hide toggles and cross-tab updates', async () => {
    renderHostedPage();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    const current = screen.getByTestId('video-1');
    const actions = renderHook(() => useAgeRestrictedPreference());
    act(() => actions.result.current.markAgeRestricted('unrelated-video'));
    act(() => actions.result.current.setHideAgeRestricted(true));
    act(() => {
      localStorage.setItem('discovered-age-restricted-video-ids', '["another-video"]');
      window.dispatchEvent(new StorageEvent('storage', { key: 'discovered-age-restricted-video-ids', newValue: '["another-video"]' }));
    });
    expect(screen.getByTestId('video-1')).toBe(current);
    expect(mounts).toHaveLength(3);
  });
});
