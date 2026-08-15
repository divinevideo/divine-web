import { Outlet } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { createHead, UnheadProvider } from '@unhead/react/client';
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

vi.mock('@/components/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function renderRouter() {
  const head = createHead();
  return render(
    <UnheadProvider head={head}>
      <AppRouter />
    </UnheadProvider>,
  );
}

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

    renderRouter();

    expect(screen.getByTestId('analytics-page')).toBeInTheDocument();
    expect(screen.queryByTestId('nip19-page')).not.toBeInTheDocument();
  });

  it('redirects the retired new-video feed to hot', async () => {
    window.history.pushState({}, '', '/discovery/new');

    renderRouter();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/discovery/hot');
    });
    expect(screen.getByTestId('discovery-page')).toBeInTheDocument();
  });

  it('routes the account portability entry point at /exit', () => {
    window.history.pushState({}, '', '/exit');

    renderRouter();

    expect(
      screen.getByRole('heading', { name: 'Move your Divine account' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('nip19-page')).not.toBeInTheDocument();
  });

  it('redirects the legacy account portability docs path to /exit', async () => {
    window.history.pushState({}, '', '/account-portability');

    renderRouter();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/exit');
    });
  });

  it('routes the delete account guide', () => {
    window.history.pushState({}, '', '/delete-account');

    renderRouter();

    expect(
      screen.getByRole('heading', { name: 'Delete your Divine account' }),
    ).toBeInTheDocument();
  });
});
