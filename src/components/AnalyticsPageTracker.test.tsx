import { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsPageTracker } from './AnalyticsPageTracker';

const trackProductEvent = vi.fn().mockResolvedValue('event-id');
vi.mock('@/lib/analyticsClient', () => ({
  trackProductEvent: (...args: unknown[]) => trackProductEvent(...args),
}));

vi.mock('@/lib/analytics', () => ({
  trackPageView: vi.fn(),
}));

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
}

function screenTimeCalls() {
  return trackProductEvent.mock.calls.filter(([name]) => name === 'screen_time');
}

describe('AnalyticsPageTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setVisibilityState('visible');
    Object.defineProperty(document, 'title', {
      configurable: true,
      value: 'Divine',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks session start and screen time on route changes', () => {
    function NavigateToDiscovery({ active }: { active: boolean }) {
      const navigate = useNavigate();

      useEffect(() => {
        if (active) {
          navigate('/discovery');
        }
      }, [active, navigate]);

      return null;
    }

    const { rerender, unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <AnalyticsPageTracker />
        <NavigateToDiscovery active={false} />
        <Routes>
          <Route path="/" element={<div />} />
          <Route path="/discovery" element={<div />} />
        </Routes>
      </MemoryRouter>
    );

    expect(trackProductEvent).toHaveBeenCalledWith('session_started', {
      surface: 'home',
      entry_point: 'direct',
      properties: { path: '/' },
    });

    vi.advanceTimersByTime(1500);

    act(() => {
      rerender(
        <MemoryRouter initialEntries={['/']}>
          <AnalyticsPageTracker />
          <NavigateToDiscovery active />
          <Routes>
            <Route path="/" element={<div />} />
            <Route path="/discovery" element={<div />} />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(trackProductEvent).toHaveBeenCalledWith('screen_time', expect.objectContaining({
      surface: 'home',
      duration_ms: expect.any(Number),
      properties: { path: '/' },
    }));

    unmount();
  });

  it('retries session_started on the next route change when it was dropped', async () => {
    // track() returns null when identity is not configured yet. The one-shot
    // must not latch on that, or the session event is lost for the whole visit.
    trackProductEvent.mockResolvedValueOnce(null);

    function NavigateOnce() {
      const navigate = useNavigate();
      useEffect(() => {
        navigate('/discovery');
      }, [navigate]);
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <AnalyticsPageTracker />
        <Routes>
          <Route path="/" element={<NavigateOnce />} />
          <Route path="/discovery" element={<div />} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const sessionCalls = trackProductEvent.mock.calls.filter(
      ([name]) => name === 'session_started',
    );
    expect(sessionCalls).toHaveLength(2);
  });

  it('emits session_started once when a redirect races the first call', async () => {
    // The one-shot guard latches on the resolved event id. A redirect before
    // that resolution re-runs the effect, so without a synchronous in-flight
    // guard the visit reports two session starts with different event ids.
    let resolveFirst: (value: string) => void = () => {};
    trackProductEvent.mockImplementationOnce(
      () => new Promise<string>((resolve) => {
        resolveFirst = resolve;
      }),
    );

    function NavigateOnce() {
      const navigate = useNavigate();
      useEffect(() => {
        navigate('/discovery');
      }, [navigate]);
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <AnalyticsPageTracker />
        <Routes>
          <Route path="/" element={<NavigateOnce />} />
          <Route path="/discovery" element={<div />} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {
      resolveFirst('event-id');
      await Promise.resolve();
    });

    const sessionCalls = trackProductEvent.mock.calls.filter(
      ([name]) => name === 'session_started',
    );
    expect(sessionCalls).toHaveLength(1);
  });

  it('emits the current screen duration when the tab is hidden', () => {
    render(
      <MemoryRouter initialEntries={['/discovery']}>
        <AnalyticsPageTracker />
      </MemoryRouter>,
    );

    vi.advanceTimersByTime(2000);

    act(() => {
      setVisibilityState('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(trackProductEvent).toHaveBeenCalledWith('screen_time', expect.objectContaining({
      surface: 'discovery',
      properties: { path: '/discovery' },
    }));
    expect(screenTimeCalls()).toHaveLength(1);
  });

  it('emits the current screen duration on pagehide', () => {
    render(
      <MemoryRouter initialEntries={['/discovery']}>
        <AnalyticsPageTracker />
      </MemoryRouter>,
    );

    vi.advanceTimersByTime(2000);

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    const [, props] = screenTimeCalls()[0];
    expect(props).toMatchObject({ surface: 'discovery' });
    expect((props as { duration_ms: number }).duration_ms).toBeGreaterThan(0);
  });

  it('does not re-count a duration already emitted at leave time', () => {
    // pagehide often follows visibilitychange, and unmount can follow both.
    // Each emission resets the clock, so the later ones have nothing to report.
    const { unmount } = render(
      <MemoryRouter initialEntries={['/discovery']}>
        <AnalyticsPageTracker />
      </MemoryRouter>,
    );

    vi.advanceTimersByTime(2000);

    act(() => {
      setVisibilityState('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pagehide'));
    });
    unmount();

    expect(screenTimeCalls()).toHaveLength(1);
  });

  it('tracks feed scroll depth once per threshold', () => {
    render(
      <MemoryRouter initialEntries={['/discovery']}>
        <AnalyticsPageTracker />
      </MemoryRouter>
    );

    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 500,
    });

    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(300);
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(300);

    expect(trackProductEvent).toHaveBeenCalledWith('feed_scrolled', {
      surface: 'discovery',
      value: 50,
      properties: {
        path: '/discovery',
        scroll_depth_percent: 50,
      },
    });
  });
});
