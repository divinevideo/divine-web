// ABOUTME: Component that tracks page views automatically as user navigates
// ABOUTME: Uses React Router location changes to log analytics page_view events

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/analytics';

export function AnalyticsPageTracker() {
  const location = useLocation();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    // Only track page view when pathname changes, not on every query param change
    // This prevents tracking every keystroke in search (search tracks separately)
    if (lastTrackedPath.current !== location.pathname) {
      lastTrackedPath.current = location.pathname;
      trackPageView(location.pathname + location.search, document.title);
    }
  }, [location]);

  return null; // This component doesn't render anything
}
