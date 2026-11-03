import { render, waitFor } from '@testing-library/react';
import { createHead, UnheadProvider } from '@unhead/react/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18n } from '@/lib/i18n';
import Index from './Index';
import DiscoveryPage from './DiscoveryPage';

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null, isAuthPending: false }),
}));

vi.mock('@/hooks/useFollowList', () => ({
  useFollowList: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ data: [] }),
}));

vi.mock('@/hooks/useFeaturedTab', () => ({
  useFeaturedTab: () => ({ tab: null, isResolved: true }),
}));

vi.mock('@/hooks/useVideoProvider', () => ({
  useFunnelcakeSupport: () => ({ apiUrl: 'https://api.divine.video', supported: true, enabled: true }),
}));

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/components/VideoFeed', () => ({ VideoFeed: () => null }));
vi.mock('@/components/VerifiedOnlyToggle', () => ({ VerifiedOnlyToggle: () => null }));
vi.mock('@/components/HashtagExplorer', () => ({ HashtagExplorer: () => null }));
vi.mock('@/components/ClassicVinersRow', () => ({ ClassicVinersRow: () => null }));

function LocationProbe({ onChange }: { onChange: (path: string) => void }) {
  const { pathname } = useLocation();
  onChange(pathname);
  return null;
}

function renderApp(initialPath: string) {
  let currentPath = initialPath;
  render(
    <UnheadProvider head={createHead()}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/discovery/:tab" element={<DiscoveryPage />} />
        </Routes>
        <LocationProbe onChange={(path) => { currentPath = path; }} />
      </MemoryRouter>
    </UnheadProvider>,
  );
  return { getPath: () => currentPath };
}

function canonicalHref(): string | null {
  return document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
}

describe('homepage SEO for signed-out visitors', () => {
  beforeEach(async () => {
    document.head.innerHTML = '';
    document.title = '';
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  it('does not point the homepage canonical at the tab it redirects to', async () => {
    const { getPath } = renderApp('/');

    await waitFor(() => expect(getPath()).toBe('/discovery/classics'));
    // Let unhead flush whatever the redirected page sets.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(canonicalHref()).not.toBe('https://divine.video/discovery/classics');
    expect(document.title).not.toBe('Classic Vines - Divine');
  });

  it('still sets discovery metadata when a visitor opens a tab directly', async () => {
    renderApp('/discovery/classics');

    await waitFor(() => expect(document.title).toBe('Classic Vines - Divine'));
    expect(canonicalHref()).toBe('https://divine.video/discovery/classics');
  });
});
