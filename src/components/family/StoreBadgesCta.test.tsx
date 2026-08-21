import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StoreBadgesCta } from './StoreBadgesCta';

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/components/HubSpotSignup', () => ({
  HubSpotSignup: () => <div data-testid="hubspot-signup" />,
}));

describe('StoreBadgesCta', () => {
  it('renders newsletter copy without promising an invite code when signup is enabled', () => {
    render(<StoreBadgesCta campaign="family" withSignup />);

    expect(
      screen.getByText('Divine is live in the App Store and on Google Play. Want our news in your inbox? Sign up here.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/invite code/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('hubspot-signup')).toBeInTheDocument();
  });

  it('does not render the newsletter signup by default', () => {
    render(<StoreBadgesCta campaign="family" />);

    expect(screen.queryByText(/Want our news in your inbox/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('hubspot-signup')).not.toBeInTheDocument();
  });
});
