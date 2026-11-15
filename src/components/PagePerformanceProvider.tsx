import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

import { PagePerformanceContext } from '@/contexts/PagePerformanceContext';
import { startContentLoad, type ContentOutcome } from '@/lib/contentPerformance';
import { getPerformanceRoute, measuresContentReadiness } from '@/lib/performanceRoutes';
import { observeVideoStartup } from '@/lib/playbackPerformance';

export function PagePerformanceProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navTypeRef = useRef(navigationType);
  navTypeRef.current = navigationType;
  const firstPath = useRef(location.pathname);
  const pending = useRef<ReturnType<typeof startContentLoad> | null>(null);
  const initialPending = useRef(true);
  useLayoutEffect(() => {
    const root = document.documentElement;
    delete root.dataset.performanceReady;
    delete root.dataset.performanceOutcome;
    const route = getPerformanceRoute(location.pathname);
    const initial = initialPending.current && (location.pathname === firstPath.current || navTypeRef.current === 'REPLACE');
    if (!initial) initialPending.current = false;
    if (!measuresContentReadiness(route)) return;
    root.dataset.performanceReady = 'false';
    const stopPlayback = observeVideoStartup(route);
    const load = startContentLoad(route, location.pathname, initial, () => { initialPending.current = false; });
    pending.current = load;
    return () => {
      stopPlayback();
      load.finish('cancelled', false);
      if (pending.current === load) pending.current = null;
      delete root.dataset.performanceReady;
      delete root.dataset.performanceOutcome;
    };
    // Depend on pathname only: query/hash-only navigations (search debounce, filter
    // changes) must not open a fresh content-readiness span.
  }, [location.pathname]);
  const reportReady = useCallback((outcome: ContentOutcome) => {
    if (pending.current?.key === location.pathname) pending.current.report(outcome);
  }, [location.pathname]);
  return <PagePerformanceContext.Provider value={reportReady}>{children}</PagePerformanceContext.Provider>;
}
