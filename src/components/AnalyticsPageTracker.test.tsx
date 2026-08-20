import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsPageTracker } from './AnalyticsPageTracker';

const trackProductEvent = vi.fn().mockResolvedValue('event-id');
const captureProductAnalyticsUtm = vi.fn().mockReturnValue({
  utm_source: 'newsletter',
  utm_medium: 'email',
});

vi.mock('@/lib/analyticsClient', () => ({
  captureProductAnalyticsUtm: (...args: unknown[]) => captureProductAnalyticsUtm(...args),
  classifyProductAnalyticsReferrer: () => 'campaign',
  trackProductEvent: (...args: unknown[]) => trackProductEvent(...args),
}));

vi.mock('@/lib/analytics', () => ({ trackPageView: vi.fn() }));

describe('AnalyticsPageTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captureProductAnalyticsUtm.mockReturnValue({
      utm_source: 'newsletter',
      utm_medium: 'email',
    });
  });

  it('records an anonymous landing with only allowlisted campaign fields', () => {
    render(
      <MemoryRouter initialEntries={['/?utm_source=Newsletter&utm_medium=email&utm_term=private']}>
        <AnalyticsPageTracker />
      </MemoryRouter>,
    );

    expect(captureProductAnalyticsUtm).toHaveBeenCalledWith(
      '?utm_source=Newsletter&utm_medium=email&utm_term=private',
    );
    expect(trackProductEvent).toHaveBeenCalledWith('landing_viewed', {
      landing_page: 'home',
      referrer_class: 'campaign',
      utm_source: 'newsletter',
      utm_medium: 'email',
    });
  });

  it('records one bounded navigation context on a route change', () => {
    function NavigateToDiscovery({ active }: { active: boolean }) {
      const navigate = useNavigate();
      useEffect(() => {
        if (active) navigate('/discovery');
      }, [active, navigate]);
      return null;
    }

    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <AnalyticsPageTracker />
        <NavigateToDiscovery active={false} />
        <Routes>
          <Route path="/" element={<div />} />
          <Route path="/discovery" element={<div />} />
        </Routes>
      </MemoryRouter>,
    );

    trackProductEvent.mockClear();
    act(() => {
      rerender(
        <MemoryRouter initialEntries={['/']}>
          <AnalyticsPageTracker />
          <NavigateToDiscovery active />
          <Routes>
            <Route path="/" element={<div />} />
            <Route path="/discovery" element={<div />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(trackProductEvent).toHaveBeenCalledWith('navigation_context_recorded', {
      from_surface: 'feed',
      to_surface: 'discovery',
      action: 'open',
    });
  });

  it('does not emit retired session, screen-time, or scroll events', () => {
    render(
      <MemoryRouter initialEntries={['/discovery']}>
        <AnalyticsPageTracker />
      </MemoryRouter>,
    );
    window.dispatchEvent(new Event('scroll'));
    document.dispatchEvent(new Event('visibilitychange'));

    const names = trackProductEvent.mock.calls.map(([name]) => name);
    expect(names).not.toContain('session_started');
    expect(names).not.toContain('screen_time');
    expect(names).not.toContain('feed_scrolled');
  });
});
