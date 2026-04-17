import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18n } from '@/lib/i18n';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { Support } from './Support';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock('@/components/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="marketing-layout">{children}</div>,
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({ canUseDirectMessages: false }),
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
  });

  it('renders support page copy in spanish', () => {
    render(
      <MemoryRouter>
        <Support />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Soporte' })).toBeInTheDocument();
    expect(screen.getByText('Necesitas una mano? Te tenemos.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Centro de ayuda Divine' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contactar con soporte' })).toBeInTheDocument();
  });
});
