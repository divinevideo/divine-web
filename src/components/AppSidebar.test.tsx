import { fireEvent, render, screen } from '@testing-library/react';
import { Tag } from '@phosphor-icons/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupportDmConversationPath } from '@/lib/dmAccessPolicy';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { initializeI18n } from '@/lib/i18n';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/mobileStoreLinks';
import { AppSidebar } from './AppSidebar';
import type { CategoryWithConfig } from '@/hooks/useCategories';

const { mockNavigate, mockSetTheme, mockCategories, shell } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSetTheme: vi.fn(),
  mockCategories: [] as CategoryWithConfig[],
  shell: {
    user: null as { pubkey: string } | null,
    canUseDirectMessages: false,
  },
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ data: mockCategories }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ displayTheme: 'light', setTheme: mockSetTheme }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: shell.user }),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useUnreadNotificationCount: () => ({ data: 0 }),
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({
    canUseDirectMessages: shell.canUseDirectMessages,
  }),
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
    shell.user = null;
    shell.canUseDirectMessages = false;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setLanguages(languages: readonly string[]) {
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: languages,
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

  it('hides the sidebar imported Vines total', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/vines (recovered|recuperados)/i)).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows both store badges', () => {
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Download Divine on the App Store' })).toHaveAttribute(
      'href',
      APP_STORE_URL,
    );
    expect(screen.getByRole('link', { name: 'Get Divine on Google Play' })).toHaveAttribute(
      'href',
      PLAY_STORE_URL,
    );
  });

  it('shows the App Store badge regardless of browser locale', () => {
    // A bare language tag with no region used to skip the storefront lookup
    // entirely, which hid the badge. The link is static now.
    setLanguages(['en']);

    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Download Divine on the App Store' })).toBeVisible();
  });

  it('renders the App Store badge without injecting a third-party script', () => {
    // The badge must not depend on a network call: under the Fastly edge
    // shell's CSP the lookup script was blocked and the badge disappeared.
    const scriptsBefore = document.head.getElementsByTagName('script').length;

    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Download Divine on the App Store' })).toBeVisible();
    expect(document.head.getElementsByTagName('script')).toHaveLength(scriptsBefore);
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

  it('navigates to the services directory from the top-level nav', () => {
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Services' }));
    expect(mockNavigate).toHaveBeenCalledWith('/services');
  });

  it('marks the services nav item active on the prerendered /services/ URL', () => {
    // Cloudflare Pages 308-redirects /services to /services/, so a direct hit,
    // reload, or shared link always lands on the trailing-slash form.
    render(
      <MemoryRouter initialEntries={['/services/']}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Services' })).toHaveClass(
      'bg-primary',
    );
  });

  it('links to the services directory from the footer Divine links', async () => {
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /acerca de divine/i }));

    const link = await screen.findByRole('link', { name: 'Services' });
    expect(link).toHaveAttribute('href', '/services');
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

  it('labels and opens the canonical Support conversation', () => {
    shell.user = { pubkey: 'a'.repeat(64) };
    shell.canUseDirectMessages = true;
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mensaje al soporte' }));
    expect(mockNavigate).toHaveBeenCalledWith(getSupportDmConversationPath());
  });
});
