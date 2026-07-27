import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initializeI18n } from '@/lib/i18n';
import { DIVINE_SERVICES } from '@/config/divineServices';
import ServicesPage from './ServicesPage';

vi.mock('@/components/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marketing-layout">{children}</div>
  ),
}));

describe('ServicesPage', () => {
  beforeEach(async () => {
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  it('renders the title and intro copy', () => {
    render(
      <MemoryRouter>
        <ServicesPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Divine services' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/more than loops/i)).toBeInTheDocument();
  });

  it('links every configured service to its URL in a new tab', () => {
    render(
      <MemoryRouter>
        <ServicesPage />
      </MemoryRouter>,
    );

    for (const service of DIVINE_SERVICES) {
      const link = screen.getByRole('link', { name: `Open ${service.name}` });
      expect(link).toHaveAttribute('href', service.url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
      expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
    }
  });
});
