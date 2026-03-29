import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

function IdentityProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

vi.mock('@/components/NostrProvider', () => ({
  default: IdentityProvider,
}));

vi.mock('@/components/EventCachePreloader', () => ({
  EventCachePreloader: () => <div data-testid="event-cache-preloader" />,
}));

vi.mock('@/components/SentryUserSync', () => ({
  SentryUserSync: () => <div data-testid="sentry-user-sync" />,
}));

vi.mock('@/components/DivineJWTWindowNostr', () => ({
  DivineJWTWindowNostr: () => <div data-testid="divine-jwt-window-nostr" />,
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => null,
}));

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: IdentityProvider,
}));

vi.mock('@nostrify/react/login', () => ({
  NostrLoginProvider: IdentityProvider,
}));

vi.mock('@/components/AppProvider', () => ({
  AppProvider: IdentityProvider,
}));

vi.mock('@/contexts/NWCContext', () => ({
  NWCProvider: IdentityProvider,
}));

vi.mock('@/contexts/VideoPlaybackContext', () => ({
  VideoPlaybackProvider: IdentityProvider,
}));

vi.mock('@/contexts/FullscreenFeedContext', () => ({
  FullscreenFeedProvider: IdentityProvider,
}));

vi.mock('./AppRouter', () => ({
  default: () => <div data-testid="app-router" />,
}));

import App from './App';

describe('App', () => {
  it('mounts the JWT window.nostr compatibility component at the app root', () => {
    render(<App />);

    expect(screen.getByTestId('divine-jwt-window-nostr')).toBeInTheDocument();
    expect(screen.getByTestId('app-router')).toBeInTheDocument();
  });
});
