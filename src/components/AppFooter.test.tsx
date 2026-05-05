import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppFooter } from './AppFooter';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'menu.merch' ? 'Translated merch' : key),
  }),
}));

vi.mock('./HubSpotSignup', () => ({
  HubSpotSignup: () => <div data-testid="hubspot-signup" />,
}));

describe('AppFooter', () => {
  it('renders a DMCA & Copyright link to /dmca', () => {
    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'DMCA & Copyright' })).toHaveAttribute('href', '/dmca');
  });

  it('renders a merch store link', () => {
    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Translated merch' })).toHaveAttribute(
      'href',
      'https://www.bonfire.com/store/divine-18/',
    );
  });
});
