import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tag } from '@phosphor-icons/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { initializeI18n } from '@/lib/i18n';
import DiscoveryPage from './DiscoveryPage';
import type { CategoryWithConfig } from '@/hooks/useCategories';
import type { DiscoveryListItem } from '@/hooks/useDiscoveryLists';

const {
  mockNavigate,
  mockCategories,
  mockDiscoveryListsData,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockCategories: [] as CategoryWithConfig[],
  mockDiscoveryListsData: [] as DiscoveryListItem[],
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ data: mockCategories }),
}));

vi.mock('@/hooks/useDiscoveryLists', () => ({
  useDiscoveryLists: () => ({ data: mockDiscoveryListsData, isLoading: false, isError: false }),
}));

vi.mock('@/hooks/useDiscoveryListPreviews', () => ({
  useDiscoveryListPreviews: () => ({
    getMemberMetadata: () => undefined,
    getVideoThumbnail: () => undefined,
  }),
}));

vi.mock('@/components/VideoFeed', () => ({
  VideoFeed: () => <div data-testid="video-feed" />,
}));

vi.mock('@/components/HashtagExplorer', () => ({
  HashtagExplorer: () => <div data-testid="hashtag-explorer" />,
}));

vi.mock('@/components/ClassicVinersRow', () => ({
  ClassicVinersRow: () => <div data-testid="classic-viners-row" />,
}));

vi.mock('@/components/UnifiedListCard', () => ({
  UnifiedListCard: ({ list }: { list: { name: string } }) => (
    <div data-testid="unified-list-card">{list.name}</div>
  ),
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

  it('renders a Lists tab trigger in the tab list', () => {
    render(
      <MemoryRouter initialEntries={['/discovery/classics']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Tab label text is rendered in the active locale (es → "Listas")
    const listsTabText = screen.getByText(/listas/i);
    expect(listsTabText).toBeInTheDocument();
    expect(listsTabText.closest('[role="tab"]')).toBeInTheDocument();
  });

  it('activating the Lists tab renders UnifiedListCard items', async () => {
    const user = userEvent.setup();

    mockDiscoveryListsData.length = 0;
    mockDiscoveryListsData.push(
      {
        kind: 30000,
        list: {
          id: 'pl-1',
          pubkey: 'a'.repeat(64),
          name: 'Cool People',
          members: ['b'.repeat(64)],
          createdAt: 1_700_000_000,
        },
      } as DiscoveryListItem,
    );

    render(
      <MemoryRouter initialEntries={['/discovery/lists']}>
        <Routes>
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Activate the lists tab by clicking the trigger text
    const listsTabText = screen.getByText(/listas/i);
    await user.click(listsTabText);

    expect(screen.getByTestId('lists-grid')).toBeInTheDocument();
    expect(screen.getByTestId('unified-list-card')).toBeInTheDocument();
    expect(screen.getByText('Cool People')).toBeInTheDocument();
  });
});
