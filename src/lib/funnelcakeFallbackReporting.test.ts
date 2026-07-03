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

  it('silently skips reporting when the underlying error is an AbortError', async () => {
    const { reportFunnelcakeFallback } = await import('./funnelcakeFallbackReporting');
    const analytics = await import('@/lib/analytics');
    const sentry = await import('@/lib/sentry');

    reportFunnelcakeFallback({
      source: 'useSearchUsers',
      apiUrl: 'https://api.divine.video',
      reason: 'signal is aborted without reason',
      error: new DOMException('signal is aborted without reason', 'AbortError'),
    });

    expect(sentry.addBreadcrumb).not.toHaveBeenCalled();
    expect(sentry.captureNonFatalError).not.toHaveBeenCalled();
    expect(analytics.trackNonFatalError).not.toHaveBeenCalled();
  });

  it('still reports genuine errors passed via the error option', async () => {
    const { reportFunnelcakeFallback } = await import('./funnelcakeFallbackReporting');
    const sentry = await import('@/lib/sentry');

    reportFunnelcakeFallback({
      source: 'useSearchUsers',
      apiUrl: 'https://api.divine.video',
      reason: 'Funnelcake API error: 500 Internal Server Error',
      error: new Error('Funnelcake API error: 500 Internal Server Error'),
    });

    expect(sentry.captureNonFatalError).toHaveBeenCalledTimes(1);
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

describe('isAbortError', () => {
  it('detects DOMException AbortError', async () => {
    const { isAbortError } = await import('./funnelcakeFallbackReporting');
    expect(isAbortError(new DOMException('signal is aborted without reason', 'AbortError'))).toBe(true);
  });

  it('detects plain errors renamed to AbortError', async () => {
    const { isAbortError } = await import('./funnelcakeFallbackReporting');
    const error = new Error('The user aborted a request.');
    error.name = 'AbortError';
    expect(isAbortError(error)).toBe(true);
  });

  it('does not flag timeouts as aborts', async () => {
    const { isAbortError } = await import('./funnelcakeFallbackReporting');
    expect(isAbortError(new DOMException('signal timed out', 'TimeoutError'))).toBe(false);
  });

  it('does not flag ordinary errors or non-errors', async () => {
    const { isAbortError } = await import('./funnelcakeFallbackReporting');
    expect(isAbortError(new Error('Funnelcake API error: 500'))).toBe(false);
    expect(isAbortError('AbortError')).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });
});
