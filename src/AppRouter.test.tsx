import { Outlet } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppRouter from './AppRouter';

// These cases cover the legacy client, which only ships when VITE_WEB_MODE=full.
vi.mock('./config/webMode', () => ({
  WEB_MODE: 'full',
  isShowcaseMode: () => false,
}));

const { mockUseCurrentUser } = vi.hoisted(() => ({
  mockUseCurrentUser: vi.fn(() => ({
    user: undefined,
    isResolvingJwt: true,
  })),
}));

// FullAppRoutes imports these through the `@/` alias, so the mocks have to use
// the same specifier — a relative path registers a different module key when
// the suite runs alongside other files.
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock('@/hooks/useSubdomainUser', () => ({
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

vi.mock('@/pages/AnalyticsPage', () => ({
  default: () => <div data-testid="analytics-page" />,
}));

vi.mock('@/pages/NIP19Page', () => ({
  NIP19Page: () => <div data-testid="nip19-page" />,
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

  // The full route table is a lazy chunk now, so this has to await the import.
  it('keeps analytics routed while a saved session is restoring', async () => {
    window.history.pushState({}, '', '/analytics');

    render(<AppRouter />);

    // Generous timeout: resolving this lazy chunk pulls in the whole legacy page
    // graph, which can exceed the 1s default when the full suite is running.
    expect(
      await screen.findByTestId('analytics-page', {}, { timeout: 15000 }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('nip19-page')).not.toBeInTheDocument();
  });
});
