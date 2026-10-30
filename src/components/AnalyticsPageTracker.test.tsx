import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsPageTracker } from './AnalyticsPageTracker';
import { SYNTHETIC_NSEC } from '@/test/secretKeyFixture';

const trackProductEvent = vi.fn().mockResolvedValue('event-id');
const captureProductAnalyticsUtm = vi.fn().mockReturnValue({
  utm_source: 'newsletter',
  utm_medium: 'email',
});
const trackPageView = vi.fn();

vi.mock('@/lib/analyticsClient', () => ({
  captureProductAnalyticsUtm: (...args: unknown[]) => captureProductAnalyticsUtm(...args),
  classifyProductAnalyticsReferrer: () => 'campaign',
  trackProductEvent: (...args: unknown[]) => trackProductEvent(...args),
}));

vi.mock('@/lib/analytics', () => ({ trackPageView: (...args: unknown[]) => trackPageView(...args) }));

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
      from_surface: 'landing',
      to_surface: 'discovery',
      action: 'open',
    });
  });

  it('does not record retired invite URLs before they redirect', () => {
    render(
      <MemoryRouter initialEntries={['/invite/ABCD-1234?utm_source=old-invite']}>
        <AnalyticsPageTracker />
      </MemoryRouter>,
    );

    expect(captureProductAnalyticsUtm).not.toHaveBeenCalled();
    expect(trackProductEvent).not.toHaveBeenCalled();
    expect(trackPageView).not.toHaveBeenCalled();
  });

  it('records the address a page was opened with', () => {
    render(
      <MemoryRouter initialEntries={['/search?q=cats&sort=top']}>
        <AnalyticsPageTracker />
      </MemoryRouter>,
    );

    expect(trackPageView).toHaveBeenCalledWith('/search?q=cats&sort=top', document.title);
  });

  it('leaves a secret key in the address out of the page view', () => {
    render(
      <MemoryRouter initialEntries={[`/search?q=${SYNTHETIC_NSEC}&sort=top`]}>
        <AnalyticsPageTracker />
      </MemoryRouter>,
    );

    expect(trackPageView).toHaveBeenCalledWith('/search', document.title);
    expect(JSON.stringify(trackPageView.mock.calls).toLowerCase()).not.toContain('nsec1');
  });

  it.each([
    `q=%6E${SYNTHETIC_NSEC.slice(1)}`,
    `q=${Array.from(SYNTHETIC_NSEC, char => `%${char.charCodeAt(0).toString(16)}`).join('')}`,
    `q=cats&q=my+key+%4E${SYNTHETIC_NSEC.slice(1).toUpperCase()}`,
    // A bare parameter name decodes to the key with an empty value
    `%6E${SYNTHETIC_NSEC.slice(1)}`,
  ])('omits encoded secret-key input from the page view (%#)', query => {
    render(
      <MemoryRouter initialEntries={[`/search?${query}&sort=top`]}>
        <AnalyticsPageTracker />
      </MemoryRouter>,
    );

    expect(trackPageView).toHaveBeenCalledWith('/search', document.title);
  });

  it('uses the real home route for the feed and does not label invented routes', () => {
    function NavigateToHome() {
      const navigate = useNavigate();
      useEffect(() => navigate('/home'), [navigate]);
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/following']}>
        <AnalyticsPageTracker />
        <NavigateToHome />
      </MemoryRouter>,
    );

    expect(trackProductEvent).toHaveBeenCalledWith('navigation_context_recorded', {
      from_surface: 'unknown',
      to_surface: 'feed',
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
