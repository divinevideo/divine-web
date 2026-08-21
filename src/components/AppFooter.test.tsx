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
  it('describes the signup as a newsletter without promising an invite code', () => {
    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('Divine is live in the App Store and on Google Play. Want our news in your inbox? Sign up here.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/invite code/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('hubspot-signup')).toBeInTheDocument();
  });

  it('renders a DMCA & Copyright link to /dmca', () => {
    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'DMCA & Copyright' })).toHaveAttribute('href', '/dmca');
  });

  it('renders an account portability docs link', () => {
    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Account Portability' })).toHaveAttribute(
      'href',
      '/exit',
    );
  });

  it('renders a delete account docs link', () => {
    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Delete Account' })).toHaveAttribute(
      'href',
      '/delete-account',
    );
  });

  it('renders a merch store link', () => {
    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Translated merch' })).toHaveAttribute(
      'href',
      '/merch',
    );
  });

  it('describes public availability without asking for an invite code', () => {
    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Divine is live in the app stores/)).toBeInTheDocument();
    expect(screen.queryByText(/invite code/i)).not.toBeInTheDocument();
  });
});
