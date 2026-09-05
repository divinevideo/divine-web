import { Outlet } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { createHead, UnheadProvider } from '@unhead/react/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initializeI18n } from '@/lib/i18n';
import AppRouter from './AppRouter';

interface CurrentUserMock {
  user: { pubkey: string } | undefined;
  isResolvingJwt: boolean;
}

const { mockUseCurrentUser } = vi.hoisted(() => ({
  mockUseCurrentUser: vi.fn<() => CurrentUserMock>(() => ({
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

vi.mock('./pages/ExitStartPage', () => ({
  ExitStartPage: () => <div data-testid="exit-start-page" />,
}));

vi.mock('./pages/Index', () => ({
  default: () => <div data-testid="index-page" />,
}));

vi.mock('./pages/HomePage', () => ({
  default: () => <div data-testid="home-page" />,
}));

vi.mock('./pages/CollabsPage', () => ({
  default: () => <div data-testid="collabs-page" />,
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
  beforeEach(async () => {
    mockUseCurrentUser.mockReset();
    mockUseCurrentUser.mockReturnValue({
      user: undefined,
      isResolvingJwt: true,
    });
    sessionStorage.clear();
    window.history.pushState({}, '', '/');
    await initializeI18n({ force: true, languages: ['en-US'] });
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

  it('redirects retired invite URLs to ordinary signup without retaining the code', async () => {
    mockUseCurrentUser.mockReturnValue({
      user: undefined,
      isResolvingJwt: false,
    });
    window.history.pushState({}, '', '/invite/ABCD-1234?utm_source=old-invite');

    renderRouter();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
    expect(window.location.search).toBe('');
    expect(sessionStorage.getItem('openSignup')).toBe('1');
    expect(screen.getByTestId('index-page')).toBeInTheDocument();
  });

  it('redirects retired invite URLs away from signup while a session is active', async () => {
    mockUseCurrentUser.mockReturnValue({
      user: { pubkey: 'a'.repeat(64) },
      isResolvingJwt: false,
    });
    window.history.pushState({}, '', '/invite/ABCD-1234');

    renderRouter();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/home');
    });
    expect(sessionStorage.getItem('openSignup')).toBeNull();
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
  });

  it('waits for session restoration before redirecting a stale session to signup', async () => {
    window.history.pushState({}, '', '/invite/ABCD-1234');

    const view = renderRouter();

    expect(window.location.pathname).toBe('/invite/ABCD-1234');
    expect(sessionStorage.getItem('openSignup')).toBeNull();
    expect(screen.getByRole('status', { name: 'Verifying...' })).toBeInTheDocument();

    mockUseCurrentUser.mockReturnValue({
      user: undefined,
      isResolvingJwt: false,
    });
    view.rerender(
      <UnheadProvider head={createHead()}>
        <AppRouter />
      </UnheadProvider>,
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
    expect(sessionStorage.getItem('openSignup')).toBe('1');
  });

  it('keeps collaborator invitations routed separately', () => {
    window.history.pushState({}, '', '/collabs/invite');

    renderRouter();

    expect(screen.getByTestId('collabs-page')).toBeInTheDocument();
  });

  it('routes the account portability entry point at /exit', () => {
    window.history.pushState({}, '', '/exit');

    renderRouter();

    expect(
      screen.getByRole('heading', { name: 'Move your Divine account' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('nip19-page')).not.toBeInTheDocument();
  });

  it('routes the public download page outside the app shell', () => {
    window.history.pushState({}, '', '/download');

    renderRouter();

    expect(screen.getByRole('heading', { name: 'Get Divine' })).toBeInTheDocument();
    expect(screen.queryByTestId('nip19-page')).not.toBeInTheDocument();
  });

  it('redirects the legacy account portability docs path to /exit', async () => {
    window.history.pushState({}, '', '/account-portability');

    renderRouter();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/exit');
    });
  });

  it('routes the account export tool at /exit/start', () => {
    window.history.pushState({}, '', '/exit/start');

    renderRouter();

    expect(screen.getByTestId('exit-start-page')).toBeInTheDocument();
  });

  it('routes the delete account guide', () => {
    window.history.pushState({}, '', '/delete-account');

    renderRouter();

    expect(
      screen.getByRole('heading', { name: 'Delete your Divine account' }),
    ).toBeInTheDocument();
  });
});
