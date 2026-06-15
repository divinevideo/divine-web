import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  trackNonFatalError: vi.fn(),
}));

vi.mock('@/lib/sentry', () => ({
  addBreadcrumb: vi.fn(),
  captureNonFatalError: vi.fn(),
}));

describe('reportFunnelcakeFallback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('reports a breadcrumb and non-fatal errors to both backends', async () => {
    const { reportFunnelcakeFallback } = await import('./funnelcakeFallbackReporting');
    const analytics = await import('@/lib/analytics');
    const sentry = await import('@/lib/sentry');

    reportFunnelcakeFallback({
      source: 'useAuthor',
      apiUrl: 'https://api.divine.video',
      reason: 'REST returned no profile',
      context: { pubkey: 'abc123' },
    });

    expect(sentry.addBreadcrumb).toHaveBeenCalledWith(
      'Funnelcake fallback to WebSocket',
      'api',
      expect.objectContaining({
        source: 'useAuthor',
        apiUrl: 'https://api.divine.video',
        reason: 'REST returned no profile',
        pubkey: 'abc123',
      }),
    );

    expect(sentry.captureNonFatalError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'FunnelcakeFallbackError',
        message: 'Funnelcake fallback to WebSocket in useAuthor: REST returned no profile',
      }),
      expect.objectContaining({
        source: 'useAuthor',
        apiUrl: 'https://api.divine.video',
        reason: 'REST returned no profile',
        pubkey: 'abc123',
      }),
    );

    expect(analytics.trackNonFatalError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'FunnelcakeFallbackError',
      }),
      expect.objectContaining({
        source: 'useAuthor',
        apiUrl: 'https://api.divine.video',
        reason: 'REST returned no profile',
        pubkey: 'abc123',
      }),
    );
  });

  it('deduplicates repeated reports within the window', async () => {
    const { reportFunnelcakeFallback } = await import('./funnelcakeFallbackReporting');
    const analytics = await import('@/lib/analytics');

    reportFunnelcakeFallback({
      source: 'useVideoProvider',
      reason: 'Funnelcake unavailable or circuit breaker open',
      dedupeKey: 'provider-fallback',
    });

    reportFunnelcakeFallback({
      source: 'useVideoProvider',
      reason: 'Funnelcake unavailable or circuit breaker open',
      dedupeKey: 'provider-fallback',
    });

    expect(analytics.trackNonFatalError).toHaveBeenCalledTimes(1);
  });
});
