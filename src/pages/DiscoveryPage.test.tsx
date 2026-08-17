import { render, screen } from '@testing-library/react';
import { Tag } from '@phosphor-icons/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { initializeI18n } from '@/lib/i18n';
import DiscoveryPage from './DiscoveryPage';
import type { CategoryWithConfig } from '@/hooks/useCategories';
import type { ResolvedFeaturedTab } from '@/types/featuredTabs';

function getPartnershipDisclosure(text: string): HTMLElement {
  return screen.getByText(
    (_, element) => element?.textContent === text,
    { selector: 'span' },
  );
}

function queryPartnershipDisclosure(): HTMLElement | null {
  return screen.queryByText(
    (_, element) => element?.textContent?.includes('colaboración pagada') ?? false,
    { selector: 'span' },
  );
}

const {
  mockNavigate,
  mockCategories,
  mockFeaturedTab,
  mockCurrentUser,
  mockTrackEvent,
  mockFeaturedResolved,
  mockResolvingJwt,
  mockFeaturedApiUrl,
  mockFeaturedFeedState,
  mockUseFeaturedTabArgs,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockTrackEvent: vi.fn(),
  mockCategories: [] as CategoryWithConfig[],
  mockFeaturedTab: { current: null as ResolvedFeaturedTab | null },
  mockFeaturedResolved: { current: true },
  mockCurrentUser: { current: null as { pubkey: string } | null },
  mockResolvingJwt: { current: false },
  mockFeaturedApiUrl: { current: 'https://api.divine.video' },
  mockFeaturedFeedState: { current: 'normal' as 'normal' | 'empty' | 'failed' },
  mockUseFeaturedTabArgs: [] as Array<{ apiUrl?: string } | undefined>,
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: mockCurrentUser.current,
    isResolvingJwt: mockResolvingJwt.current,
  }),
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ data: mockCategories }),
}));

vi.mock('@/hooks/useFeaturedTab', () => ({
  useFeaturedTab: (args?: { apiUrl?: string }) => {
    mockUseFeaturedTabArgs.push(args);
    return {
      tab: mockFeaturedTab.current,
      isResolved: mockFeaturedResolved.current,
    };
  },
}));

vi.mock('@/hooks/useVideoProvider', () => ({
  useFunnelcakeSupport: () => ({
    apiUrl: mockFeaturedApiUrl.current,
    supported: true,
    enabled: true,
  }),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: mockTrackEvent,
}));

vi.mock('@/components/VideoFeed', () => ({
  VideoFeed: ({ feedType, featuredTabId }: { feedType: string; featuredTabId?: string }) => {
    const message = feedType === 'featured' && mockFeaturedFeedState.current !== 'normal'
      ? mockFeaturedFeedState.current
      : null;

    return (
      <div data-testid={`video-feed-${feedType}`} data-featured-tab-id={featuredTabId}>
        {message}
      </div>
    );
  },
}));

vi.mock('@/components/HashtagExplorer', () => ({
  HashtagExplorer: () => <div data-testid="hashtag-explorer" />,
}));

vi.mock('@/components/ClassicVinersRow', () => ({
  ClassicVinersRow: () => <div data-testid="classic-viners-row" />,
}));

describe('DiscoveryPage', () => {
  beforeEach(async () => {
    const storage = new Map<string, string>();

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
    });

    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    await initializeI18n({ force: true, languages: ['en-US'] });

    mockNavigate.mockReset();
    mockTrackEvent.mockReset();
    mockCategories.length = 0;
    mockFeaturedTab.current = null;
    mockFeaturedResolved.current = true;
    mockResolvingJwt.current = false;
    mockCurrentUser.current = null;
    mockFeaturedApiUrl.current = 'https://api.divine.video';
    mockFeaturedFeedState.current = 'normal';
    mockUseFeaturedTabArgs.length = 0;
  });

  it('renders localized discovery copy and category pills', () => {
    mockCategories.push({
      name: 'music',
      video_count: 42,
      config: {
        icon: Tag,
        label: 'Music',
        emoji: '🎵',
      },
    });

    render(
      <MemoryRouter initialEntries={['/discovery/classics']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Descubrir' })).toBeInTheDocument();
    expect(screen.getByText('Explora videos de la red')).toBeInTheDocument();
    expect(screen.getByText('Clasico')).toBeInTheDocument();
    expect(screen.getByText('Musica')).toBeInTheDocument();
  });

  it('does not expose or render the all-new video feed', () => {
    render(
      <MemoryRouter initialEntries={['/discovery/new']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('tab', { name: 'Nuevo' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('video-feed-recent')).not.toBeInTheDocument();
  });

  it('renders no featured tab or content feed when no configuration is eligible', () => {
    render(
      <MemoryRouter initialEntries={['/discovery/classics']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('video-feed-featured')).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('data-state'))).toHaveLength(3);
  });

  it('uses the same Funnelcake host for featured config that feeds use for featured videos', () => {
    mockFeaturedApiUrl.current = 'https://api.staging.divine.video';

    render(
      <MemoryRouter initialEntries={['/discovery/classics']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(mockUseFeaturedTabArgs.at(-1)).toEqual({
      apiUrl: 'https://api.staging.divine.video',
    });
  });

  it('inserts an eligible featured tab after classics and before hot', () => {
    mockFeaturedTab.current = {
      id: 'ft_1234abcd',
      slug: 'seasonal-theme',
      label: 'Especial',
      pillLabel: 'Skate week',
      sponsorName: null,
    };

    render(
      <MemoryRouter initialEntries={['/discovery/classics']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Clasico',
      'DestacadoSkate week',
      'Popular',
      'Etiquetas',
    ]);
  });

  it('keeps the featured tab after classics when foryou is visible', () => {
    mockCurrentUser.current = { pubkey: 'viewer-pubkey' };
    mockFeaturedTab.current = {
      id: 'ft_1234abcd',
      slug: 'seasonal-theme',
      label: 'Especial',
      pillLabel: null,
      sponsorName: null,
    };

    render(
      <MemoryRouter initialEntries={['/discovery/classics']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Para ti',
      'Clasico',
      'Destacado',
      'Popular',
      'Etiquetas',
    ]);
  });

  it('counts one featured tab impression across configuration refreshes', () => {
    const config = (): ResolvedFeaturedTab => ({
      id: 'ft_1234abcd',
      slug: 'seasonal-theme',
      label: 'Especial',
      pillLabel: null,
      sponsorName: null,
    });
    mockFeaturedTab.current = config();

    const tree = () => (
      <MemoryRouter initialEntries={['/discovery/seasonal-theme']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>
    );
    const { rerender } = render(tree());

    expect(mockTrackEvent).toHaveBeenCalledExactlyOnceWith('featured_tab_impression', {
      featured_tab_id: 'ft_1234abcd',
    });

    // The 5-minute config poll resolves the same tab into a fresh object.
    mockFeaturedTab.current = config();
    rerender(tree());

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  });

  it('sends a slug no configuration claims back to the default tab', () => {
    render(
      <MemoryRouter initialEntries={['/discovery/expired-campaign']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(mockNavigate).toHaveBeenCalledWith('/discovery/classics', { replace: true });
  });

  it('leaves an unknown slug alone while the featured configuration is still loading', () => {
    // The slug may still turn out to be a valid featured tab, so redirecting
    // here would break a deep link into a live campaign.
    mockFeaturedResolved.current = false;

    render(
      <MemoryRouter initialEntries={['/discovery/seasonal-theme']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('keeps the active featured route while the cached config is temporarily unresolved', () => {
    mockFeaturedTab.current = {
      id: 'ft_1234abcd',
      slug: 'seasonal-theme',
      label: 'Especial',
      pillLabel: null,
      sponsorName: null,
    };

    const tree = () => (
      <MemoryRouter initialEntries={['/discovery/seasonal-theme']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>
    );

    const { rerender } = render(tree());

    expect(screen.getByTestId('video-feed-featured')).toHaveAttribute('data-featured-tab-id', 'ft_1234abcd');
    mockNavigate.mockReset();

    mockFeaturedTab.current = null;
    mockFeaturedResolved.current = false;
    rerender(tree());

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('keeps a logged-in foryou deep link while the hosted session is still resolving', () => {
    // The JWT has not resolved, so there is no user yet and `foryou` is briefly
    // absent from the tab list. Redirecting here would replace the bookmark.
    mockResolvingJwt.current = true;

    render(
      <MemoryRouter initialEntries={['/discovery/foryou']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('resolves direct navigation to the configured featured slug', () => {
    mockFeaturedTab.current = {
      id: 'ft_1234abcd',
      slug: 'seasonal-theme',
      label: 'Especial',
      pillLabel: 'Skate week',
      sponsorName: 'Acme Bikes',
    };

    render(
      <MemoryRouter initialEntries={['/discovery/seasonal-theme']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('video-feed-featured')).toHaveAttribute('data-featured-tab-id', 'ft_1234abcd');
    const disclosure = getPartnershipDisclosure('En colaboración pagada con Acme Bikes');
    expect(disclosure).toBeInTheDocument();
    expect(disclosure.querySelector('bdi')).toHaveTextContent('Acme Bikes');
    expect(screen.getByRole('tab', { name: 'Destacado: Skate week' })).toHaveTextContent('Skate week');
    expect(screen.getAllByText(/Acme Bikes/)).toHaveLength(1);
  });

  it('does not render partnership copy for an unsponsored featured tab', () => {
    mockFeaturedTab.current = {
      id: 'ft_1234abcd',
      slug: 'seasonal-theme',
      label: 'Especial',
      pillLabel: 'Skate week',
      sponsorName: null,
    };

    render(
      <MemoryRouter initialEntries={['/discovery/seasonal-theme']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(queryPartnershipDisclosure()).not.toBeInTheDocument();
  });

  it.each(['empty', 'failed'] as const)(
    'keeps partnership copy visible when the featured feed is %s',
    (feedState) => {
      mockFeaturedFeedState.current = feedState;
      mockFeaturedTab.current = {
        id: 'ft_1234abcd',
        slug: 'seasonal-theme',
        label: 'Especial',
        pillLabel: null,
        sponsorName: 'Acme Bikes',
      };

      render(
        <MemoryRouter initialEntries={['/discovery/seasonal-theme']}>
          <Routes>
            <Route path="/discovery/:tab" element={<DiscoveryPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(getPartnershipDisclosure('En colaboración pagada con Acme Bikes')).toBeInTheDocument();
      expect(screen.getByText(feedState)).toBeInTheDocument();
    },
  );

  it('wraps the sponsor name with bdi for RTL disclosure copy', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ar');
    await initializeI18n({ force: true, languages: ['ar'] });
    mockFeaturedTab.current = {
      id: 'ft_1234abcd',
      slug: 'seasonal-theme',
      label: 'Especial',
      pillLabel: null,
      sponsorName: 'Acme Bikes',
    };

    render(
      <MemoryRouter initialEntries={['/discovery/seasonal-theme']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const disclosure = getPartnershipDisclosure('شراكة مدفوعة مع Acme Bikes');
    expect(disclosure.querySelector('bdi')).toHaveTextContent('Acme Bikes');
  });

  it('names every tab trigger when labels are visually hidden on mobile', () => {
    mockFeaturedTab.current = {
      id: 'ft_1234abcd',
      slug: 'seasonal-theme',
      label: 'Especial',
      pillLabel: 'Skate week',
      sponsorName: 'Acme Bikes',
    };

    render(
      <MemoryRouter initialEntries={['/discovery/classics']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'))).toEqual([
      'Clasico',
      'Destacado: Skate week',
      'Popular',
      'Etiquetas',
    ]);
  });
});
