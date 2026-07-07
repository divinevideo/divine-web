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

describe('AnalyticsPageTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
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
