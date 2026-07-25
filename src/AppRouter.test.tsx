import { Outlet } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppRouter from './AppRouter';

const { mockUseCurrentUser } = vi.hoisted(() => ({
  mockUseCurrentUser: vi.fn(() => ({
    user: undefined,
    isResolvingJwt: true,
  })),
}));

vi.mock('./hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock('./hooks/useSubdomainUser', () => ({
  getSubdomainUser: () => null,
}));

vi.mock('./components/ScrollToTop', () => ({
  ScrollToTop: () => null,
}));

vi.mock('./components/AnalyticsPageTracker', () => ({
  AnalyticsPageTracker: () => null,
}));

vi.mock('./components/AnalyticsUserTracker', () => ({
  AnalyticsUserTracker: () => null,
}));

vi.mock('@/components/AppLayout', () => ({
  AppLayout: () => <Outlet />,
}));

vi.mock('./pages/AnalyticsPage', () => ({
  default: () => <div data-testid="analytics-page" />,
}));

vi.mock('./pages/NIP19Page', () => ({
  NIP19Page: () => <div data-testid="nip19-page" />,
}));

vi.mock('./pages/DiscoveryPage', () => ({
  default: () => <div data-testid="discovery-page" />,
}));

describe('AppRouter', () => {
  beforeEach(() => {
    mockUseCurrentUser.mockReset();
    mockUseCurrentUser.mockReturnValue({
      user: undefined,
      isResolvingJwt: true,
    });
    window.history.pushState({}, '', '/');
  });

  it('keeps analytics routed while a saved session is restoring', () => {
    window.history.pushState({}, '', '/analytics');

    render(<AppRouter />);

    expect(screen.getByTestId('analytics-page')).toBeInTheDocument();
    expect(screen.queryByTestId('nip19-page')).not.toBeInTheDocument();
  });

  it('redirects the retired new-video feed to hot', async () => {
    window.history.pushState({}, '', '/discovery/new');

    render(<AppRouter />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/discovery/hot');
    });
    expect(screen.getByTestId('discovery-page')).toBeInTheDocument();
  });
});
