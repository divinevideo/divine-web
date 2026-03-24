import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppFooter } from './AppFooter';

vi.mock('./HubSpotSignup', () => ({
  HubSpotSignup: () => <div data-testid="hubspot-signup" />,
}));

describe('AppFooter', () => {
  it('renders a Copyright & DMCA link to /dmca', () => {
    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Copyright & DMCA' })).toHaveAttribute('href', '/dmca');
  });
});
