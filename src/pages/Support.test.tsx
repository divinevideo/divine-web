import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupportDmConversationPath } from '@/lib/dmAccessPolicy';
import { initializeI18n } from '@/lib/i18n';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { Support } from './Support';

const { mockNavigate, supportState } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  supportState: {
    user: null as { pubkey: string } | null,
    canUseDirectMessages: false,
  },
}));

vi.mock('@/components/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="marketing-layout">{children}</div>,
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: supportState.user }),
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({
    canUseDirectMessages: supportState.canUseDirectMessages,
  }),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

describe('Support page', () => {
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
    supportState.user = null;
    supportState.canUseDirectMessages = false;
  });

  it('renders support page copy in spanish', () => {
    render(
      <MemoryRouter>
        <Support />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Soporte' })).toBeInTheDocument();
    expect(screen.getByText('Necesitas ayuda? Estamos aqui para ayudarte.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Visitar el centro de ayuda de Divine' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contactar con soporte' })).toBeInTheDocument();
  });

  it('links to account portability and deletion docs', () => {
    render(
      <MemoryRouter>
        <Support />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Account help' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Move your account' })).toHaveAttribute('href', '/exit');
    expect(screen.getByRole('link', { name: 'Delete your account' })).toHaveAttribute(
      'href',
      '/delete-account',
    );
  });

  it('opens the canonical Support conversation', () => {
    supportState.user = { pubkey: 'a'.repeat(64) };
    supportState.canUseDirectMessages = true;
    render(
      <MemoryRouter>
        <Support />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Abrir chat de soporte' }));
    expect(mockNavigate).toHaveBeenCalledWith(getSupportDmConversationPath());
  });
});
