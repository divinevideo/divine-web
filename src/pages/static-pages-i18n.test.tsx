import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { initializeI18n } from '@/lib/i18n';
import { FAQPage } from './FAQPage';
import { TermsPage } from './TermsPage';
import { PrivacyPage } from './PrivacyPage';
import { SafetyPage } from './SafetyPage';

vi.mock('@/components/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="marketing-layout">{children}</div>,
}));

vi.mock('@/components/ZendeskWidget', () => ({
  ZendeskWidget: () => null,
}));

describe('static pages i18n', () => {
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

  it('renders faq copy in spanish', () => {
    render(
      <MemoryRouter>
        <FAQPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Preguntas frecuentes' })).toBeInTheDocument();
    expect(screen.getByText('Todo lo que necesitas saber sobre Divine')).toBeInTheDocument();
  });

  it('renders terms copy in spanish', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Términos del servicio' })).toBeInTheDocument();
  });

  it('renders privacy copy in spanish', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Política de privacidad' })).toBeInTheDocument();
  });

  it('renders safety copy in spanish', () => {
    render(
      <MemoryRouter>
        <SafetyPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Normas de seguridad' })).toBeInTheDocument();
  });
});
