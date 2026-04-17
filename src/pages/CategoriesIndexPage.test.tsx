import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18n } from '@/lib/i18n';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import CategoriesIndexPage from './CategoriesIndexPage';

const { mockUseCategories } = vi.hoisted(() => ({
  mockUseCategories: vi.fn(),
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => mockUseCategories(),
}));

vi.mock('@unhead/react', () => ({
  useSeoMeta: vi.fn(),
}));

vi.mock('@/components/SmartLink', () => ({
  SmartLink: ({ children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('CategoriesIndexPage', () => {
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
  });

  it('renders the page header and empty state in spanish', () => {
    mockUseCategories.mockReturnValue({ data: [], isLoading: false });

    render(
      <MemoryRouter>
        <CategoriesIndexPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Categorias' })).toBeInTheDocument();
    expect(screen.getByText('Loops, ordenados por vibe.')).toBeInTheDocument();
    expect(screen.getByText('No hay categorias en marcha ahora mismo.')).toBeInTheDocument();
  });

  it('renders translated category labels from the shared category map', () => {
    mockUseCategories.mockReturnValue({
      data: [
        {
          name: 'music',
          video_count: 2,
          config: {
            emoji: '🎵',
            label: 'Music',
          },
        },
      ],
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <CategoriesIndexPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Musica')).toBeInTheDocument();
    expect(screen.getByText('2 videos')).toBeInTheDocument();
  });
});
