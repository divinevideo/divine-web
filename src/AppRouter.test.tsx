import { Outlet } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { createHead, UnheadProvider } from '@unhead/react/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProductAnalyticsUtm } from '@/lib/analyticsClient';
import { initializeI18n } from '@/lib/i18n';
import AppRouter from './AppRouter';

interface CurrentUserMock {
  user: { pubkey: string } | undefined;
  isAuthPending: boolean;
  isRenewingSession?: boolean;
}

const { mockUseCurrentUser, homePageMounts } = vi.hoisted(() => ({
  mockUseCurrentUser: vi.fn<() => CurrentUserMock>(() => ({
    user: undefined,
    isAuthPending: true,
  })),
  homePageMounts: { count: 0 },
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

vi.mock('./pages/HomePage', async () => {
  const { useEffect } = await import('react');
  return {
    default: function HomePage() {
      useEffect(() => {
        homePageMounts.count += 1;
      }, []);
      return <div data-testid="home-page" />;
    },
  };
});

vi.mock('./pages/CollabsPage', () => ({
  default: () => <div data-testid="collabs-page" />,
}));

vi.mock('./pages/chat/ChatPage', () => ({
  default: () => <div data-testid="chat-page" />,
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
      isAuthPending: true,
    });
    sessionStorage.clear();
    window.history.pushState({}, '', '/');
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  // A reload of a logged-in page has a moment before the saved sign-in
  // finishes loading (divine-web#266). That moment must not show the
  // not-found page, or the page's own signed-out fallback.
  it('shows a loading state on a logged-in page while sign-in is still loading', () => {
    window.history.pushState({}, '', '/analytics');

    const view = renderRouter();

    expect(screen.getByRole('status', { name: 'Verifying...' })).toBeInTheDocument();
    expect(screen.queryByTestId('analytics-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nip19-page')).not.toBeInTheDocument();

    mockUseCurrentUser.mockReturnValue({
      user: { pubkey: 'a'.repeat(64) },
      isAuthPending: false,
    });
    view.rerender(
      <UnheadProvider head={createHead()}>
        <AppRouter />
      </UnheadProvider>,
    );

    expect(screen.getByTestId('analytics-page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/analytics');
  });

  // A hosted session renews its token while the reader is on the page, and
  // has no user until the new token resolves. Unmounting the page then would
  // throw away what it holds, such as a half-written message.
  it('keeps a logged-in page mounted while a hosted session renews its token', () => {
    const signedIn = { user: { pubkey: 'a'.repeat(64) }, isAuthPending: false };
    const rerenderRouter = (view: ReturnType<typeof renderRouter>) =>
      view.rerender(
        <UnheadProvider head={createHead()}>
          <AppRouter />
        </UnheadProvider>,
      );
    homePageMounts.count = 0;
    mockUseCurrentUser.mockReturnValue(signedIn);
    window.history.pushState({}, '', '/home');

    const view = renderRouter();
    mockUseCurrentUser.mockReturnValue({
      user: undefined,
      isAuthPending: true,
      isRenewingSession: true,
    });
    rerenderRouter(view);

    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Verifying...' })).not.toBeInTheDocument();

    mockUseCurrentUser.mockReturnValue(signedIn);
    rerenderRouter(view);

    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(homePageMounts.count).toBe(1);
  });

  // Signing out into a saved login that is still loading, or switching to
  // one, is a new sign-in rather than a renewal. Keeping the page mounted
  // would show its signed-out fallback until the next account loads.
  it('shows the loading state again when a later sign-in is still loading', () => {
    const rerenderRouter = (view: ReturnType<typeof renderRouter>) =>
      view.rerender(
        <UnheadProvider head={createHead()}>
          <AppRouter />
        </UnheadProvider>,
      );
    mockUseCurrentUser.mockReturnValue({
      user: { pubkey: 'a'.repeat(64) },
      isAuthPending: false,
    });
    window.history.pushState({}, '', '/home');

    const view = renderRouter();
    mockUseCurrentUser.mockReturnValue({ user: undefined, isAuthPending: true });
    rerenderRouter(view);

    expect(screen.getByRole('status', { name: 'Verifying...' })).toBeInTheDocument();
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();

    mockUseCurrentUser.mockReturnValue({
      user: { pubkey: 'b'.repeat(64) },
      isAuthPending: false,
    });
    rerenderRouter(view);

    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/home');
  });

  it('keeps logged-in pages unavailable once sign-in has finished without a user', () => {
    mockUseCurrentUser.mockReturnValue({
      user: undefined,
      isAuthPending: false,
    });
    window.history.pushState({}, '', '/home');

    renderRouter();

    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Verifying...' })).not.toBeInTheDocument();
    expect(screen.getByTestId('nip19-page')).toBeInTheDocument();
  });

  it('redirects the retired new-video feed to hot', async () => {
    window.history.pushState({}, '', '/discovery/new');

    renderRouter();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/discovery/hot');
    });
    expect(screen.getByTestId('discovery-page')).toBeInTheDocument();
  });

  it('redirects retired invite URLs to ordinary signup with sanitized campaign attribution', async () => {
    mockUseCurrentUser.mockReturnValue({
      user: undefined,
      isAuthPending: false,
    });
    window.history.pushState(
      {},
      '',
      '/invite/ABCD-1234?utm_source=Old-Invite&utm_campaign=launch-1&utm_term=secret&next=/admin',
    );

    renderRouter();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
    expect(window.location.search).toBe('');
    expect(sessionStorage.getItem('openSignup')).toBe('1');
    expect(getProductAnalyticsUtm()).toEqual({
      utm_source: 'old-invite',
      utm_campaign: 'launch-1',
    });
    expect(screen.getByTestId('index-page')).toBeInTheDocument();
  });

  it('redirects retired invite URLs away from signup while a session is active', async () => {
    mockUseCurrentUser.mockReturnValue({
      user: { pubkey: 'a'.repeat(64) },
      isAuthPending: false,
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
      isAuthPending: false,
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

  it('routes chat invite links (naddr in the path) to the chat page instead of the retired invite redirect', async () => {
    mockUseCurrentUser.mockReturnValue({
      user: undefined,
      isResolvingJwt: false,
    });
    window.history.pushState({}, '', '/invite/naddr1xyz#AAEAESIzRFVmd4iZqrvM3e7_');

    renderRouter();

    expect(await screen.findByTestId('chat-page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/invite/naddr1xyz');
    expect(sessionStorage.getItem('openSignup')).toBeNull();
  });

  it('keeps collaborator invitations routed separately', () => {
    mockUseCurrentUser.mockReturnValue({
      user: { pubkey: 'a'.repeat(64) },
      isAuthPending: false,
    });
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
