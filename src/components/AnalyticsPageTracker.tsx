// ABOUTME: Records page views and the small, allowlisted product navigation contract.
// ABOUTME: Campaign values are sanitized before they enter the product event queue.

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import type {
  ProductAnalyticsV2LandingPage,
  ProductAnalyticsV2Surface,
} from '@/generated/productAnalytics';
import { trackPageView } from '@/lib/analytics';
import {
  captureProductAnalyticsUtm,
  classifyProductAnalyticsReferrer,
  trackProductEvent,
} from '@/lib/analyticsClient';

function getSurface(pathname: string): ProductAnalyticsV2Surface {
  if (pathname === '/') return 'landing';
  if (pathname === '/home') return 'feed';
  if (
    pathname.startsWith('/discovery')
    || pathname === '/trending'
    || pathname === '/popular'
    || pathname === '/hashtags'
    || pathname.startsWith('/hashtag/')
    || pathname === '/category'
    || pathname.startsWith('/category/')
    || pathname.startsWith('/t/')
  ) return 'discovery';
  if (pathname.startsWith('/search')) return 'search_results';
  if (pathname.startsWith('/profile') || pathname.startsWith('/u/')) return 'profile';
  if (pathname.startsWith('/invite/')) return 'registration';
  if (pathname.startsWith('/notifications')) return 'notifications';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'unknown';
}

function getLandingPage(pathname: string): ProductAnalyticsV2LandingPage | null {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/invite/')) return 'invite';
  return null;
}

export function AnalyticsPageTracker() {
  const location = useLocation();
  const previousPath = useRef<string | null>(null);
  const recordedLandings = useRef(new Set<string>());

  useEffect(() => {
    const pathname = location.pathname;
    const utm = captureProductAnalyticsUtm(location.search);
    const landingPage = getLandingPage(pathname);

    if (landingPage && !recordedLandings.current.has(pathname)) {
      recordedLandings.current.add(pathname);
      void trackProductEvent('landing_viewed', {
        landing_page: landingPage,
        referrer_class: classifyProductAnalyticsReferrer(
          document.referrer,
          Object.keys(utm).length > 0,
        ),
        ...utm,
      });
    }

    if (previousPath.current && previousPath.current !== pathname) {
      void trackProductEvent('navigation_context_recorded', {
        from_surface: getSurface(previousPath.current),
        to_surface: getSurface(pathname),
        action: 'open',
      });
    }

    if (previousPath.current !== pathname) {
      trackPageView(pathname + location.search, document.title);
      previousPath.current = pathname;
    }
  }, [location.pathname, location.search]);

  return null;
}
