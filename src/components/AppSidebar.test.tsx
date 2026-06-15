import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Tag } from '@phosphor-icons/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  afterEach(() => {
    document.head.querySelectorAll('script[src*="itunes.apple.com/lookup"]').forEach((script) => script.remove());
  });

  function setLanguages(languages: readonly string[]) {
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: languages,
    });
  }

  async function resolveLatestAppStoreLookup(result: unknown) {
    let script: HTMLScriptElement | null = null;
    await waitFor(() => {
      script = document.head.querySelector<HTMLScriptElement>('script[src*="itunes.apple.com/lookup"]');
      expect(script).not.toBeNull();
    });

    const callback = new URL(script!.src).searchParams.get('callback');
    expect(callback).toBeTruthy();

    await act(async () => {
      (window as unknown as Record<string, (value: unknown) => void>)[callback!](result);
      await Promise.resolve();
    });
  }

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

  it('shows the App Store badge when Apple lookup finds the regional listing', async () => {
    setLanguages(['en-NZ']);

    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    await resolveLatestAppStoreLookup({
      resultCount: 1,
      results: [{ trackViewUrl: 'https://apps.apple.com/nz/app/divine-video/id6747959501?uo=4' }],
    });

    expect(await screen.findByRole('link', { name: 'Download Divine on the App Store' })).toHaveAttribute(
      'href',
      'https://apps.apple.com/nz/app/divine-video/id6747959501?uo=4',
    );
  });

  it('hides the App Store badge when Apple lookup has no regional listing', async () => {
    setLanguages(['en-US']);

    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    await resolveLatestAppStoreLookup({
      resultCount: 0,
      results: [],
    });

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Download Divine on the App Store' })).not.toBeInTheDocument();
    });
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
