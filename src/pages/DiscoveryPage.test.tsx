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
    (_, element) => element?.textContent?.includes('Patrocinado por') ?? false,
    { selector: 'span' },
  );
}

const FEATURED_GLYPH = '🌮';

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
      `${FEATURED_GLYPH}DestacadoSkate week`,
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
      `${FEATURED_GLYPH}Destacado`,
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
    const disclosure = getPartnershipDisclosure('Patrocinado por Acme Bikes');
    expect(disclosure).toBeInTheDocument();
    expect(disclosure.querySelector('bdi')).toHaveTextContent('Acme Bikes');
    expect(screen.getByRole('tab', { name: 'Destacado: Skate week' })).toHaveTextContent('Skate week');
    expect(screen.getAllByText(/Acme Bikes/)).toHaveLength(1);
  });

  // The disclosure renders as a text node followed by a <bdi> element. In a
  // flex container those become two separate flex items, and flex layout drops
  // the trailing whitespace of the anonymous text item — so the sponsor name
  // renders welded to the word before it. jsdom does no layout, so textContent
  // still reports the space and cannot catch this; the layout mode is the only
  // thing a unit test can pin.
  it('lays the disclosure out inline so the space before the sponsor survives', async () => {
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

    const disclosure = getPartnershipDisclosure('Patrocinado por Acme Bikes');
    expect(disclosure).toHaveClass('inline-block');
    expect(disclosure.className).not.toMatch(/(^|\s)(inline-)?flex(\s|$)/);
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

      expect(getPartnershipDisclosure('Patrocinado por Acme Bikes')).toBeInTheDocument();
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

    const disclosure = getPartnershipDisclosure('برعاية Acme Bikes');
    expect(disclosure.querySelector('bdi')).toHaveTextContent('Acme Bikes');
  });

  it('keeps the sponsor first with a separating space in Urdu', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ur');
    await initializeI18n({ force: true, languages: ['ur'] });
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

    const disclosure = getPartnershipDisclosure('Acme Bikes کی جانب سے اسپانسر شدہ');
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

  describe('featured tab pill layout', () => {
    const FEATURED: ResolvedFeaturedTab = {
      id: 'ft_1234abcd',
      slug: 'seasonal-theme',
      label: 'Especial',
      pillLabel: 'Skate week',
      sponsorName: null,
    };

    function renderAt(route: string) {
      mockFeaturedTab.current = FEATURED;
      return render(
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/discovery/:tab" element={<DiscoveryPage />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    // The pill used to clip because every trigger shared an equal `1fr` grid
    // column while only the featured one carried a third child. The featured
    // trigger now sizes to its content and the rest split what is left.
    it('sizes the featured trigger to its content and lets the others share the rest', () => {
      renderAt('/discovery/seasonal-theme');

      const featured = screen.getByRole('tab', { name: 'Destacado: Skate week' });
      expect(featured).toHaveClass('shrink-0');
      expect(featured).not.toHaveClass('flex-1');

      for (const name of ['Clasico', 'Popular', 'Etiquetas']) {
        const trigger = screen.getByRole('tab', { name });
        expect(trigger).toHaveClass('flex-1', 'min-w-0');
      }
    });

    it('renders the pill label in full rather than a clipped copy', () => {
      renderAt('/discovery/seasonal-theme');

      const pill = screen.getByTestId('featured-tab-pill');
      expect(pill).toHaveTextContent('Skate week');
      expect(pill).toHaveAttribute('title', 'Skate week');
    });

    // Between `sm` and `md` the pill shows only for the active tab, so the
    // other four triggers keep their labels when the user is somewhere else.
    it('reveals the pill on the active tab and at md and up', () => {
      renderAt('/discovery/seasonal-theme');

      const pill = screen.getByTestId('featured-tab-pill');
      expect(pill).toHaveClass('hidden');
      expect(pill).toHaveClass('sm:group-data-[state=active]:inline-block');
      expect(pill).toHaveClass('md:inline-block');
      expect(
        screen.getByRole('tab', { name: 'Destacado: Skate week' }),
      ).toHaveClass('group');
    });

    it('gives the pill an opaque sticker fill so it reads on both tab states', () => {
      renderAt('/discovery/classics');

      const pill = screen.getByTestId('featured-tab-pill');
      expect(pill).toHaveClass('bg-brand-yellow', 'text-brand-dark-green');
      expect(pill).not.toHaveClass('bg-background/80');
    });
  });

  describe('featured tab glyph', () => {
    const FEATURED: ResolvedFeaturedTab = {
      id: 'ft_1234abcd',
      slug: 'seasonal-theme',
      label: 'Especial',
      pillLabel: null,
      sponsorName: null,
    };

    function renderFeatured() {
      mockFeaturedTab.current = FEATURED;
      return render(
        <MemoryRouter initialEntries={['/discovery/classics']}>
          <Routes>
            <Route path="/discovery/:tab" element={<DiscoveryPage />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it('renders the editorial emoji instead of an icon', () => {
      renderFeatured();

      const featured = screen.getByRole('tab', { name: 'Destacado' });
      expect(featured).toHaveTextContent(FEATURED_GLYPH);
      expect(featured.querySelector('svg')).toBeNull();
    });

    // The glyph is decoration on top of the trigger's own aria-label, so it
    // must not leak into the accessible name or the tab's text.
    it('hides the glyph from assistive technology and from the tab label', () => {
      renderFeatured();

      const featured = screen.getByRole('tab', { name: 'Destacado' });
      const glyph = featured.querySelector('[aria-hidden="true"]');
      expect(glyph).not.toBeNull();
      expect(glyph).toHaveTextContent(FEATURED_GLYPH);
      expect(featured).toHaveAttribute('aria-label', 'Destacado');
    });

    it('leaves the non-featured tabs on their own icons', () => {
      renderFeatured();

      for (const name of ['Clasico', 'Popular', 'Etiquetas']) {
        const trigger = screen.getByRole('tab', { name });
        expect(trigger.querySelector('svg')).not.toBeNull();
        expect(trigger.textContent).not.toContain(FEATURED_GLYPH);
      }
    });
  });
});
