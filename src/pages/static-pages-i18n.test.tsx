import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { initializeI18n } from '@/lib/i18n';
import { AboutPage } from './AboutPage';
import { AuthenticityPage } from './AuthenticityPage';
import { DMCAPage } from './DMCAPage';
import { FAQPage } from './FAQPage';
import { OpenSourcePage } from './OpenSourcePage';
import { PrivacyPage } from './PrivacyPage';
import { ProofModePage } from './ProofModePage';
import { SafetyPage } from './SafetyPage';
import { TermsPage } from './TermsPage';
import HumanCreatedPage from './HumanCreatedPage';

vi.mock('@/components/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="marketing-layout">{children}</div>,
}));

vi.mock('@/components/ZendeskWidget', () => ({
  ZendeskWidget: () => null,
}));

vi.mock('@/components/ApplePodcastEmbed', () => ({
  ApplePodcastEmbed: () => <div data-testid="apple-podcast-embed" />,
}));

vi.mock('@/hooks/usePlatformStats', () => ({
  usePlatformStats: () => ({ data: undefined }),
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
    expect(screen.getByRole('heading', { name: 'Primeros pasos' })).toBeInTheDocument();
  });

  it('renders terms title in spanish (chrome only — body stays english)', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    );

    // Page title + "last updated" label are translated; legal body paragraphs
    // remain hardcoded English per the i18n rollout decision.
    expect(screen.getByRole('heading', { name: 'Términos del servicio' })).toBeInTheDocument();
  });

  it('renders privacy title in spanish (chrome only — body stays english)', () => {
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
    expect(screen.getByRole('heading', { name: '1. Descripción general' })).toBeInTheDocument();
  });

  it('renders DMCA copy in spanish', () => {
    render(
      <MemoryRouter>
        <DMCAPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Política de derechos de autor y DMCA' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. Descripción general' })).toBeInTheDocument();
  });

  it('renders about copy in spanish', () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Acerca de Divine' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'La historia detrás de Divine' })).toBeInTheDocument();
  });

  it('renders open source copy in spanish', () => {
    render(
      <MemoryRouter>
        <OpenSourcePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Proyecto de código abierto' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '¡La beta ya está activa!' })).toBeInTheDocument();
  });

  it('renders authenticity copy in spanish', () => {
    render(
      <MemoryRouter>
        <AuthenticityPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Redes sociales por humanos, para humanos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Construyendo sobre la Vine original' })).toBeInTheDocument();
  });

  it('renders proofmode copy in spanish', () => {
    render(
      <MemoryRouter>
        <ProofModePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Proofmode: autenticidad criptográfica de video' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'El problema de los deepfakes' })).toBeInTheDocument();
  });

  it('renders human-created copy in spanish', () => {
    render(
      <MemoryRouter>
        <HumanCreatedPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Contenido creado por humanos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '¿Qué es la insignia Human-Made?' })).toBeInTheDocument();
  });
});
