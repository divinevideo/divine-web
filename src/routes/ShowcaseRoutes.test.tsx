// ABOUTME: Route-table tests for showcase mode
// ABOUTME: Proves the legacy content surface 404s while mobile deep-links still resolve

import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ShowcaseRoutes from './ShowcaseRoutes';

vi.mock('@/pages/ShowcasePage', () => ({
  default: () => <div data-testid="showcase-page" />,
}));

vi.mock('@/pages/NotFound', () => ({
  default: () => <div data-testid="not-found" />,
}));

vi.mock('@/pages/MerchPage', () => ({
  default: () => <div data-testid="merch-page" />,
}));

vi.mock('@/pages/ShowcaseVideoPage', () => ({
  default: () => <div data-testid="showcase-video-page" />,
}));

vi.mock('@/pages/AuthCallbackPage', () => ({
  default: () => <div data-testid="auth-callback" />,
}));

vi.mock('@/pages/AppCallbackPage', () => ({
  default: () => <div data-testid="app-callback" />,
}));

vi.mock('@/pages/InvitesLandingPage', () => ({
  default: () => <div data-testid="invites-landing" />,
}));

vi.mock('@/components/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/routes/documentRoutes', async () => {
  const { Route } = await import('react-router-dom');
  return {
    documentRoutes: () => (
      <>
        <Route path="/safety" element={<div data-testid="safety-page" />} />
        <Route path="/family" element={<div data-testid="family-page" />} />
      </>
    ),
  };
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ShowcaseRoutes />
    </MemoryRouter>,
  );
}

describe('ShowcaseRoutes', () => {
  it('serves the showcase page at the root', () => {
    renderAt('/');
    expect(screen.getByTestId('showcase-page')).toBeInTheDocument();
  });

  it.each([
    ['/safety', 'safety-page'],
    ['/family', 'family-page'],
    ['/merch', 'merch-page'],
    // Shared video links resolve to the safety-gated single-video page.
    ['/video/deadbeef', 'showcase-video-page'],
  ])('keeps %s reachable', (path, testId) => {
    renderAt(path);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  // The mobile apps deep-link into these; removing them breaks the apps, not
  // just the website.
  it.each([
    ['/auth/callback', 'auth-callback'],
    ['/app/callback', 'app-callback'],
    ['/invite/abc123', 'invites-landing'],
  ])('keeps the mobile deep-link target %s', (path, testId) => {
    renderAt(path);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  // This is the whole point of showcase mode: no open feed, no profiles, no
  // search. (Single videos DO resolve — via the safety-gated share page above.)
  it.each([
    '/discovery',
    '/discovery/hot',
    '/trending',
    '/popular',
    '/search',
    '/hashtags',
    '/hashtag/skate',
    '/leaderboard',
    '/profile/npub1abc',
    '/home',
    '/messages',
    '/notifications',
    '/lists',
    '/settings/moderation',
    '/get-embed',
  ])('404s the legacy route %s', (path) => {
    renderAt(path);
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
  });
});
