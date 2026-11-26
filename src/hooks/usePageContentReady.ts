import { useContext, useEffect } from 'react';

import { PagePerformanceContext, type ContentOutcome } from '@/contexts/PagePerformanceContext';

export function usePageContentReady(outcome: ContentOutcome | null) {
  const report = useContext(PagePerformanceContext);
  useEffect(() => {
    if (outcome) report?.(outcome);
  }, [outcome, report]);
}
