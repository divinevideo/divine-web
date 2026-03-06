// ABOUTME: Shared reporting for Funnelcake REST fallbacks to WebSocket/NIP-50
// ABOUTME: Logs breadcrumbs plus non-fatal reports to Sentry and Firebase analytics

import { trackNonFatalError } from '@/lib/analytics';
import { addBreadcrumb, captureNonFatalError } from '@/lib/sentry';

interface FunnelcakeFallbackReportOptions {
  source: string;
  reason: string;
  apiUrl?: string;
  fallbackTo?: 'websocket';
  context?: Record<string, unknown>;
  dedupeKey?: string;
}

const reportedFallbacks = new Map<string, number>();
const DEDUPE_WINDOW_MS = 60_000;

function shouldSkipDuplicateReport(dedupeKey?: string): boolean {
  if (!dedupeKey) return false;

  const now = Date.now();
  const lastReportedAt = reportedFallbacks.get(dedupeKey);
  if (lastReportedAt && now - lastReportedAt < DEDUPE_WINDOW_MS) {
    return true;
  }

  reportedFallbacks.set(dedupeKey, now);

  for (const [key, timestamp] of reportedFallbacks.entries()) {
    if (now - timestamp >= DEDUPE_WINDOW_MS) {
      reportedFallbacks.delete(key);
    }
  }

  return false;
}

export function reportFunnelcakeFallback({
  source,
  reason,
  apiUrl,
  fallbackTo = 'websocket',
  context,
  dedupeKey,
}: FunnelcakeFallbackReportOptions) {
  if (shouldSkipDuplicateReport(dedupeKey)) {
    return;
  }

  const metadata = {
    source,
    reason,
    apiUrl,
    fallbackTo,
    ...context,
  };

  addBreadcrumb('Funnelcake fallback to WebSocket', 'api', metadata);

  const error = new Error(`Funnelcake fallback to WebSocket in ${source}: ${reason}`);
  error.name = 'FunnelcakeFallbackError';

  captureNonFatalError(error, metadata);
  trackNonFatalError(error, metadata);
}
