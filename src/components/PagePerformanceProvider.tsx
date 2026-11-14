import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

import { PagePerformanceContext } from '@/contexts/PagePerformanceContext';
import { startContentLoad, type ContentOutcome } from '@/lib/contentPerformance';
import { getPerformanceRoute, measuresContentReadiness } from '@/lib/performanceRoutes';
import { observeVideoStartup } from '@/lib/playbackPerformance';

export function PagePerformanceProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const firstKey = useRef(location.key);
  const pending = useRef<ReturnType<typeof startContentLoad> | null>(null);
  const initialPending = useRef(true);
  useLayoutEffect(() => {
    const root = document.documentElement;
    delete root.dataset.performanceReady;
    delete root.dataset.performanceOutcome;
    const route = getPerformanceRoute(location.pathname);
    const initial = initialPending.current && (location.key === firstKey.current || navigationType === 'REPLACE');
    if (!initial || !measuresContentReadiness(route)) initialPending.current = false;
    if (!measuresContentReadiness(route)) return;
    root.dataset.performanceReady = 'false';
    const stopPlayback = observeVideoStartup(route);
    const load = startContentLoad(route, location.key, initial, () => { initialPending.current = false; });
    pending.current = load;
    return () => {
      stopPlayback();
      load.finish('cancelled', false);
      if (pending.current === load) pending.current = null;
      delete root.dataset.performanceReady;
      delete root.dataset.performanceOutcome;
    };
  }, [location.key, location.pathname, navigationType]);
  const reportReady = useCallback((outcome: ContentOutcome) => {
    if (pending.current?.key === location.key) pending.current.report(outcome);
  }, [location.key]);
  return <PagePerformanceContext.Provider value={reportReady}>{children}</PagePerformanceContext.Provider>;
}
