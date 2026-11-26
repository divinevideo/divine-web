import { createContext } from 'react';

import type { ContentOutcome } from '@/lib/contentPerformance';

export type { ContentOutcome } from '@/lib/contentPerformance';
export const PagePerformanceContext = createContext<((outcome: ContentOutcome) => void) | null>(null);
