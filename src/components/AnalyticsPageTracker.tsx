// ABOUTME: Component that tracks page views automatically as user navigates
// ABOUTME: Uses React Router location changes to log analytics page_view events

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const sessionStartInFlight = useRef(false);
  const [sessionStartAttempt, setSessionStartAttempt] = useState(0);
  const scrollTimeout = useRef<number>();
  const maxScrollThreshold = useRef(0);

  // Read inside the resolve handler below, where `location` is the value
  // captured when the call started rather than the current route.
  const currentPath = useRef(location.pathname);
  currentPath.current = location.pathname;

  useEffect(() => {
    if (sessionStarted.current || sessionStartInFlight.current) {
      return;
    }

    // Two guards, because they answer different questions.
    //
    // The in-flight flag is synchronous, so a redirect that re-runs this effect
    // before the call settles cannot emit a second session_started with a
    // different event id.
    //
    // The latch is set only once the event was actually accepted. track()
    // returns null when analytics identity is not configured yet, and this
    // effect can run before that happens, so latching on a dropped call would
    // lose the session event for the whole visit. A drop retries on the next
    // route change — including one that happened while the call was in flight,
    // which the in-flight guard would otherwise have swallowed.
    const attemptedPath = location.pathname;
    sessionStartInFlight.current = true;
    void trackProductEvent('session_started', {
      surface: getSurface(attemptedPath),
      entry_point: document.referrer ? 'referrer' : 'direct',
      properties: { path: attemptedPath },
    })
      .then((eventId) => {
        if (eventId) {
          sessionStarted.current = true;
          return;
        }
        if (currentPath.current !== attemptedPath) {
          setSessionStartAttempt((attempt) => attempt + 1);
        }
      })
      .finally(() => {
        sessionStartInFlight.current = false;
      });
  }, [location.pathname, sessionStartAttempt]);

  /**
   * Emit the time spent on the current screen and restart the clock.
   *
   * Leave-time signals overlap — visibilitychange to hidden, then pagehide,
   * then possibly unmount — so resetting the start time here is what keeps a
   * single departure from being counted several times. A zero-length span has
   * nothing to report and is skipped.
   */
  const emitScreenTime = useCallback(() => {
    const path = lastTrackedPath.current;
    if (!path) {
      return;
    }

    const durationMs = Math.max(0, Date.now() - currentPathStartedAt.current);
    if (durationMs <= 0) {
      return;
    }

    currentPathStartedAt.current = Date.now();
    void trackProductEvent('screen_time', {
      surface: getSurface(path),
      duration_ms: durationMs,
      properties: { path },
    });
  }, []);

  useEffect(() => {
    // Only track page view when pathname changes, not on every query param change
    // This prevents tracking every keystroke in search (search tracks separately)
    if (lastTrackedPath.current !== location.pathname) {
      emitScreenTime();

      lastTrackedPath.current = location.pathname;
      currentPathStartedAt.current = Date.now();
      maxScrollThreshold.current = 0;
      trackPageView(location.pathname + location.search, document.title);
    }
  }, [emitScreenTime, location]);

  useEffect(() => {
    // Unmount is not a reliable tab-close signal. Without these the final
    // screen of a single-page session never reports its duration at all, so
    // time on site is systematically under-counted.
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') {
        return;
      }
      emitScreenTime();
    };

    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', emitScreenTime);

    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', emitScreenTime);
      emitScreenTime();
    };
  }, [emitScreenTime]);

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
