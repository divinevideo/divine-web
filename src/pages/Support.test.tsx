import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
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

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({ data: undefined }),
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
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Support />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Soporte' })).toBeInTheDocument();
    expect(screen.getByText('Necesitas ayuda? Estamos aqui para ayudarte.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Visitar el centro de ayuda de Divine' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contactar con soporte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open bug form' })).toBeInTheDocument();
  });
});
