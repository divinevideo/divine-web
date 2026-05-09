import { describe, it, expect, beforeEach, vi } from 'vitest';

// We're testing module-level behavior — initializeAnalytics() is
// called once at app boot. Use vi.resetModules() between cases so
// the module re-evaluates with a fresh window flag state.

describe('analytics suppression', () => {
  beforeEach(() => {
    vi.resetModules();
    delete (window as unknown as { __DIVINE_ANALYTICS_DISABLED__?: boolean })
      .__DIVINE_ANALYTICS_DISABLED__;
  });

  it('initializeAnalytics is a no-op when __DIVINE_ANALYTICS_DISABLED__ is set', async () => {
    (window as unknown as { __DIVINE_ANALYTICS_DISABLED__?: boolean })
      .__DIVINE_ANALYTICS_DISABLED__ = true;
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const mod = await import('./analytics');
    mod.initializeAnalytics();

    // The suppressed log line is deterministic; the "Firebase App
    // initialized" line should NOT appear.
    const calls = log.mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes('Suppressed by __DIVINE_ANALYTICS_DISABLED__'))).toBe(
      true,
    );
    expect(calls.some((c) => c.includes('Firebase App initialized'))).toBe(false);
    log.mockRestore();
  });

  it('trackEvent is a no-op when suppressed (no analytics object exists)', async () => {
    (window as unknown as { __DIVINE_ANALYTICS_DISABLED__?: boolean })
      .__DIVINE_ANALYTICS_DISABLED__ = true;
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const mod = await import('./analytics');
    mod.initializeAnalytics();
    mod.trackEvent('test_event', { foo: 'bar' });

    const calls = log.mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes('Event tracked'))).toBe(false);
    log.mockRestore();
  });
});
