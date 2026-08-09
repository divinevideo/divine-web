import { render, screen } from '@testing-library/react';
import { Tag } from '@phosphor-icons/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { initializeI18n } from '@/lib/i18n';
import DiscoveryPage from './DiscoveryPage';
import type { CategoryWithConfig } from '@/hooks/useCategories';
import type { ResolvedFeaturedTab } from '@/types/featuredTabs';

const {
  mockNavigate,
  mockCategories,
  mockFeaturedTab,
  mockCurrentUser,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockCategories: [] as CategoryWithConfig[],
  mockFeaturedTab: { current: null as ResolvedFeaturedTab | null },
  mockCurrentUser: { current: null as { pubkey: string } | null },
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: mockCurrentUser.current }),
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ data: mockCategories }),
}));

vi.mock('@/hooks/useFeaturedTab', () => ({
  useFeaturedTab: () => mockFeaturedTab.current,
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/components/VideoFeed', () => ({
  VideoFeed: ({ feedType, featuredTabId }: { feedType: string; featuredTabId?: string }) => (
    <div data-testid={`video-feed-${feedType}`} data-featured-tab-id={featuredTabId} />
  ),
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
    mockCategories.length = 0;
    mockFeaturedTab.current = null;
    mockCurrentUser.current = null;
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

  it('inserts an eligible featured tab after the configured tab and renders disclosure text', () => {
    mockFeaturedTab.current = {
      id: 'ft_1234abcd',
      slug: 'seasonal-theme',
      label: 'Especial',
      position: { after: 'hot' },
      disclosureLabel: 'New',
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
      'Popular',
      'EspecialNew',
      'Etiquetas',
    ]);
  });

  it('resolves direct navigation to the configured featured slug', () => {
    mockFeaturedTab.current = {
      id: 'ft_1234abcd',
      slug: 'seasonal-theme',
      label: 'Especial',
      position: { after: 'hot' },
      disclosureLabel: null,
    };

    render(
      <MemoryRouter initialEntries={['/discovery/seasonal-theme']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('video-feed-featured')).toHaveAttribute('data-featured-tab-id', 'ft_1234abcd');
  });
});
