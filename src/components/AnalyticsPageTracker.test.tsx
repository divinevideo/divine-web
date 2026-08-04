import { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsPageTracker } from './AnalyticsPageTracker';

const trackProductEvent = vi.fn().mockResolvedValue('event-id');
const identityListeners: Array<() => void> = [];
const consentListeners: Array<(consented: boolean) => void> = [];
vi.mock('@/lib/analyticsClient', () => ({
  trackProductEvent: (...args: unknown[]) => trackProductEvent(...args),
  onProductAnalyticsIdentityChanged: (callback: () => void) => {
    identityListeners.push(callback);
    return () => {
      const index = identityListeners.indexOf(callback);
      if (index >= 0) identityListeners.splice(index, 1);
    };
  },
}));

vi.mock('@/lib/analytics', () => ({
  trackPageView: vi.fn(),
}));

vi.mock('@/lib/cookieConsent', () => ({
  onAnalyticsConsentChanged: (callback: (consented: boolean) => void) => {
    consentListeners.push(callback);
    return () => {
      const index = consentListeners.indexOf(callback);
      if (index >= 0) consentListeners.splice(index, 1);
    };
  },
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
    identityListeners.length = 0;
    consentListeners.length = 0;
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

  it('retries session_started when consent arrives after the first attempt is dropped', async () => {
    trackProductEvent.mockResolvedValueOnce(null);

    render(
      <MemoryRouter initialEntries={['/']}>
        <AnalyticsPageTracker />
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(trackProductEvent).toHaveBeenCalledTimes(1);

    await act(async () => {
      consentListeners.forEach((listener) => listener(true));
      await Promise.resolve();
    });

    const sessionCalls = trackProductEvent.mock.calls.filter(
      ([name]) => name === 'session_started',
    );
    expect(sessionCalls).toHaveLength(2);
    expect(sessionCalls[1][1]).toMatchObject({
      surface: 'home',
      properties: { path: '/' },
    });
  });

  it('retries session_started when identity is configured after the first attempt is dropped', async () => {
    trackProductEvent.mockResolvedValueOnce(null);

    render(
      <MemoryRouter initialEntries={['/profile/npub1abcdefghijklmnopqrstuvwxyz']}>
        <AnalyticsPageTracker />
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(trackProductEvent).toHaveBeenCalledTimes(1);

    await act(async () => {
      identityListeners.forEach((listener) => listener());
      await Promise.resolve();
    });

    const sessionCalls = trackProductEvent.mock.calls.filter(
      ([name]) => name === 'session_started',
    );
    expect(sessionCalls).toHaveLength(2);
    expect(sessionCalls[1][1]).toMatchObject({
      surface: 'profile',
      properties: { path: '/profile/:npub' },
    });
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

  it('does not count hidden time as screen time after the tab becomes visible again', () => {
    function NavigateToSearch({ active }: { active: boolean }) {
      const navigate = useNavigate();

      useEffect(() => {
        if (active) {
          navigate('/search');
        }
      }, [active, navigate]);

      return null;
    }

    const { rerender } = render(
      <MemoryRouter initialEntries={['/discovery']}>
        <AnalyticsPageTracker />
        <NavigateToSearch active={false} />
        <Routes>
          <Route path="/discovery" element={<div />} />
          <Route path="/search" element={<div />} />
        </Routes>
      </MemoryRouter>,
    );

    vi.advanceTimersByTime(2000);
    act(() => {
      setVisibilityState('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    act(() => {
      setVisibilityState('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    vi.advanceTimersByTime(1500);

    act(() => {
      rerender(
        <MemoryRouter initialEntries={['/discovery']}>
          <AnalyticsPageTracker />
          <NavigateToSearch active />
          <Routes>
            <Route path="/discovery" element={<div />} />
            <Route path="/search" element={<div />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    const durations = screenTimeCalls().map(([, props]) => (props as { duration_ms: number }).duration_ms);
    expect(durations).toHaveLength(2);
    expect(durations[0]).toBe(2000);
    expect(durations[1]).toBe(1500);
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

  it('templates parameterized paths before sending first-party analytics', () => {
    render(
      <MemoryRouter initialEntries={['/messages/conversation-123']}>
        <AnalyticsPageTracker />
      </MemoryRouter>,
    );

    expect(trackProductEvent).toHaveBeenCalledWith('session_started', {
      surface: 'messages',
      entry_point: 'direct',
      properties: { path: '/messages/:conversationId' },
    });
  });
});
