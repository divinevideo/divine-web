// ABOUTME: Component that tracks page views automatically as user navigates
// ABOUTME: Uses React Router location changes to log analytics page_view events

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/analytics';
import { trackProductEvent } from '@/lib/analyticsClient';

const FEED_PATHS = new Set(['/', '/discovery', '/search']);
const SCROLL_DEBOUNCE_MS = 200;

function getSurface(pathname: string): string {
  if (pathname === '/') return 'home';
  return pathname.split('/').filter(Boolean)[0] ?? 'unknown';
}

export function AnalyticsPageTracker() {
  const location = useLocation();
  const lastTrackedPath = useRef<string | null>(null);
  const currentPathStartedAt = useRef<number>(Date.now());
  const sessionStarted = useRef(false);
  const scrollTimeout = useRef<number>();
  const maxScrollThreshold = useRef(0);

  useEffect(() => {
    if (sessionStarted.current) {
      return;
    }

    sessionStarted.current = true;
    void trackProductEvent('session_started', {
      surface: getSurface(location.pathname),
      entry_point: document.referrer ? 'referrer' : 'direct',
      properties: { path: location.pathname },
    });
  }, [location.pathname]);

  useEffect(() => {
    // Only track page view when pathname changes, not on every query param change
    // This prevents tracking every keystroke in search (search tracks separately)
    if (lastTrackedPath.current !== location.pathname) {
      if (lastTrackedPath.current) {
        void trackProductEvent('screen_time', {
          surface: getSurface(lastTrackedPath.current),
          duration_ms: Math.max(0, Date.now() - currentPathStartedAt.current),
          properties: { path: lastTrackedPath.current },
        });
      }

      lastTrackedPath.current = location.pathname;
      currentPathStartedAt.current = Date.now();
      maxScrollThreshold.current = 0;
      trackPageView(location.pathname + location.search, document.title);
    }
  }, [location]);

  useEffect(() => {
    return () => {
      if (!lastTrackedPath.current) {
        return;
      }

      void trackProductEvent('screen_time', {
        surface: getSurface(lastTrackedPath.current),
        duration_ms: Math.max(0, Date.now() - currentPathStartedAt.current),
        properties: { path: lastTrackedPath.current },
      });
    };
  }, []);

  useEffect(() => {
    if (!FEED_PATHS.has(location.pathname)) {
      return;
    }

    const onScroll = () => {
      window.clearTimeout(scrollTimeout.current);
      scrollTimeout.current = window.setTimeout(() => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollable <= 0) {
          return;
        }

        const depth = Math.min(100, Math.max(0, Math.round((window.scrollY / scrollable) * 100)));
        const threshold = Math.floor(depth / 25) * 25;
        if (threshold <= 0 || threshold <= maxScrollThreshold.current) {
          return;
        }

        maxScrollThreshold.current = threshold;
        void trackProductEvent('feed_scrolled', {
          surface: getSurface(location.pathname),
          value: threshold,
          properties: {
            path: location.pathname,
            scroll_depth_percent: threshold,
          },
        });
      }, SCROLL_DEBOUNCE_MS);
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.clearTimeout(scrollTimeout.current);
      window.removeEventListener('scroll', onScroll);
    };
  }, [location.pathname]);

  return null; // This component doesn't render anything
}
