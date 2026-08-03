// ABOUTME: Tests for analytics error-tracking console behavior (#459)
// ABOUTME: Ensures non-fatal tracking never emits warn/error console lines that Sentry re-captures

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockLogEvent = vi.fn();

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(() => ({})),
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
  setUserId: vi.fn(),
  setAnalyticsCollectionEnabled: vi.fn(),
}));

vi.mock('firebase/performance', () => ({
  getPerformance: vi.fn(() => ({})),
  trace: vi.fn(),
}));

vi.mock('./cookieConsent', () => ({
  onAnalyticsConsentChanged: (callback: (consented: boolean) => void) => callback(true),
}));

async function loadEnabledAnalytics() {
  const mod = await import('./analytics');
  mod.initializeAnalytics();
  return mod;
}

describe('trackNonFatalError console echo', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('still logs the exception event to Firebase', async () => {
    const mod = await loadEnabledAnalytics();

    mod.trackNonFatalError(new Error('Funnelcake fallback to WebSocket in useAuthor: HTTP 500'), {
      source: 'useAuthor',
    });

    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.anything(),
      'exception',
      expect.objectContaining({
        description: 'Funnelcake fallback to WebSocket in useAuthor: HTTP 500',
        fatal: false,
        source: 'useAuthor',
      }),
    );
  });

  it('does not emit console.warn or console.error (Sentry captures those levels)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const mod = await loadEnabledAnalytics();

    mod.trackNonFatalError(new Error('Funnelcake fallback'), { source: 'useAuthor' });

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });

  it('never serializes context as [object Object]', async () => {
    const spies = (['debug', 'log', 'info', 'warn', 'error'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    );
    const mod = await loadEnabledAnalytics();

    mod.trackNonFatalError(new Error('Funnelcake fallback'), { source: 'useAuthor', reason: 'HTTP 500' });
    mod.trackError(new Error('boom'), { source: 'window.error' });

    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(call.map(String).join(' ')).not.toContain('[object Object]');
      }
      spy.mockRestore();
    }
  });
});
