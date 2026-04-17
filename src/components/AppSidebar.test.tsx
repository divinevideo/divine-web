import { fireEvent, render, screen } from '@testing-library/react';
import { Tag } from '@phosphor-icons/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { initializeI18n } from '@/lib/i18n';
import { AppSidebar } from './AppSidebar';
import type { CategoryWithConfig } from '@/hooks/useCategories';

const { mockNavigate, mockSetTheme, mockCategories } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSetTheme: vi.fn(),
  mockCategories: [] as CategoryWithConfig[],
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ data: mockCategories }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ displayTheme: 'light', setTheme: mockSetTheme }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useUnreadNotificationCount: () => ({ data: 0 }),
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({ canUseDirectMessages: false }),
  useUnreadDmCount: () => ({ data: 0 }),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useSubdomainUser', () => ({
  getSubdomainUser: () => null,
}));

vi.mock('@/components/auth/LoginArea', () => ({
  LoginArea: () => <div data-testid="login-area" />,
}));

vi.mock('@/hooks/useRssFeedAvailable', () => ({
  useRssFeedAvailable: () => false,
}));

vi.mock('@/hooks/usePlatformStats', () => ({
  usePlatformStats: () => ({ data: undefined }),
}));

describe('AppSidebar', () => {
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
    mockSetTheme.mockReset();
    mockCategories.length = 0;
  });

  it('renders translated shell labels and a translated DMCA action', () => {
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Buscar' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Terminos y codigo abierto' }));

    const dmcaButton = screen.getByRole('button', { name: 'DMCA y derechos de autor' });
    expect(dmcaButton).toBeVisible();

    fireEvent.click(dmcaButton);

    expect(mockNavigate).toHaveBeenCalledWith('/dmca');
  });

  it('renders translated category labels from category config', () => {
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
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /categorias/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /musica/i })).toBeVisible();
  });

  it('keeps the language chooser collapsed until opened', () => {
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /idioma: español/i })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'English' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /idioma: español/i }));

    expect(screen.getByRole('button', { name: 'English' })).toBeVisible();
  });
});
