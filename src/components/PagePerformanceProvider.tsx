import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { PagePerformanceContext } from '@/contexts/PagePerformanceContext';
import { startContentLoad, type ContentOutcome } from '@/lib/contentPerformance';
import { getPerformanceRoute, measuresContentReadiness } from '@/lib/performanceRoutes';
import { observeVideoStartup } from '@/lib/playbackPerformance';

export function PagePerformanceProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const pending = useRef<ReturnType<typeof startContentLoad> | null>(null);
  const firstLoad = useRef(true);
  useLayoutEffect(() => {
    const root = document.documentElement;
    delete root.dataset.performanceReady;
    delete root.dataset.performanceOutcome;
    const route = getPerformanceRoute(location.pathname);
    const initial = firstLoad.current;
    firstLoad.current = false;
    if (!measuresContentReadiness(route)) return;
    root.dataset.performanceReady = 'false';
    const stopPlayback = observeVideoStartup(route);
    const load = startContentLoad(route, location.key, initial);
    pending.current = load;
    return () => {
      stopPlayback();
      load.finish('cancelled');
      if (pending.current === load) pending.current = null;
      delete root.dataset.performanceReady;
      delete root.dataset.performanceOutcome;
    };
  }, [location.key, location.pathname]);
  const reportReady = useCallback((outcome: ContentOutcome) => {
    if (pending.current?.key === location.key) pending.current.report(outcome);
  }, [location.key]);
  return <PagePerformanceContext.Provider value={reportReady}>{children}</PagePerformanceContext.Provider>;
}
