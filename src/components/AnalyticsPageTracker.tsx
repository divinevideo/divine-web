// ABOUTME: Component that tracks page views automatically as user navigates
// ABOUTME: Uses React Router location changes to log analytics page_view events

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/analytics';
import { onProductAnalyticsIdentityChanged, trackProductEvent } from '@/lib/analyticsClient';
import { onAnalyticsConsentChanged } from '@/lib/cookieConsent';

const FEED_PATHS = new Set(['/', '/discovery', '/search']);
const SCROLL_DEBOUNCE_MS = 200;
const PATH_TEMPLATES: Array<[RegExp, string]> = [
  [/^\/profile\/[^/]+$/, '/profile/:npub'],
  [/^\/profile\/[^/]+\/lists$/, '/profile/:npub/lists'],
  [/^\/video\/[^/]+$/, '/video/:id'],
  [/^\/v\/[^/]+$/, '/v/:legacyVineId'],
  [/^\/hashtag\/[^/]+$/, '/hashtag/:tag'],
  [/^\/category\/[^/]+$/, '/category/:name'],
  [/^\/t\/[^/]+$/, '/t/:tag'],
  [/^\/u\/[^/]+$/, '/u/:userId'],
  [/^\/list\/[^/]+\/[^/]+$/, '/list/:pubkey/:listId'],
  [/^\/people-lists\/[^/]+\/[^/]+$/, '/people-lists/:pubkey/:listId'],
  [/^\/event\/[^/]+$/, '/event/:eventId'],
  [/^\/event\/a\/[^/]+\/[^/]+\/[^/]+$/, '/event/a/:kind/:pubkey/:identifier'],
  [/^\/messages\/[^/]+$/, '/messages/:conversationId'],
  [/^\/collabs\/[^/]+$/, '/collabs/:tab'],
  [/^\/discovery\/[^/]+$/, '/discovery/:tab'],
  [/^\/invite\/[^/]+$/, '/invite/:code'],
];

function getSurface(pathname: string): string {
  if (pathname === '/') return 'home';
  return pathname.split('/').filter(Boolean)[0] ?? 'unknown';
}

function getAnalyticsPath(pathname: string): string {
  return PATH_TEMPLATES.find(([pattern]) => pattern.test(pathname))?.[1] ?? pathname;
}

function isDocumentVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

export function AnalyticsPageTracker() {
  const location = useLocation();
  const lastTrackedPath = useRef<string | null>(null);
  const currentPathStartedAt = useRef<number | null>(isDocumentVisible() ? Date.now() : null);
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
      properties: { path: getAnalyticsPath(attemptedPath) },
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

  useEffect(() => {
    const retrySessionStart = () => {
      if (!sessionStarted.current) {
        setSessionStartAttempt((attempt) => attempt + 1);
      }
    };
    const unsubscribeConsent = onAnalyticsConsentChanged((consented) => {
      if (consented) {
        retrySessionStart();
      }
    });
    const unsubscribeIdentity = onProductAnalyticsIdentityChanged(retrySessionStart);

    return () => {
      unsubscribeConsent();
      unsubscribeIdentity();
    };
  }, []);

  const emitScreenTime = useCallback((restartClock: boolean) => {
    const path = lastTrackedPath.current;
    const startedAt = currentPathStartedAt.current;
    if (!path || startedAt === null) {
      if (restartClock) {
        currentPathStartedAt.current = Date.now();
      }
      return;
    }

    const now = Date.now();
    const durationMs = Math.max(0, now - startedAt);
    currentPathStartedAt.current = restartClock ? now : null;
    if (durationMs <= 0) {
      return;
    }

    void trackProductEvent('screen_time', {
      surface: getSurface(path),
      duration_ms: durationMs,
      properties: { path: getAnalyticsPath(path) },
    });
  }, []);

  useEffect(() => {
    // Only track page view when pathname changes, not on every query param change
    // This prevents tracking every keystroke in search (search tracks separately)
    if (lastTrackedPath.current !== location.pathname) {
      emitScreenTime(false);

      lastTrackedPath.current = location.pathname;
      currentPathStartedAt.current = isDocumentVisible() ? Date.now() : null;
      maxScrollThreshold.current = 0;
      trackPageView(location.pathname + location.search, document.title);
    }
  }, [emitScreenTime, location]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        emitScreenTime(false);
        return;
      }
      currentPathStartedAt.current = Date.now();
    };

    const onPageHide = () => emitScreenTime(false);

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      emitScreenTime(false);
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
            path: getAnalyticsPath(location.pathname),
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
