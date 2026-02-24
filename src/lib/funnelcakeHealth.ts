// ABOUTME: Circuit breaker and health monitoring for Funnelcake REST API
// ABOUTME: Tracks failures and provides automatic fallback to WebSocket queries

import { debugLog, debugError } from './debug';
import { addBreadcrumb, Sentry } from './sentry';
import type { FunnelcakeHealthStatus } from '@/types/funnelcake';

// Circuit breaker configuration
const CIRCUIT_BREAKER_THRESHOLD = 3;  // Open circuit after N consecutive failures
const CIRCUIT_BREAKER_RESET_MS = 30000;  // Auto-retry after 30 seconds

// In-memory health status (one per API base URL)
const healthStatusByUrl = new Map<string, FunnelcakeHealthStatus>();

/**
 * Get current health status for a Funnelcake API endpoint
 */
export function getFunnelcakeStatus(apiUrl: string): FunnelcakeHealthStatus {
  const existing = healthStatusByUrl.get(apiUrl);
  if (existing) {
    return { ...existing };
  }

  // Default status: available, never checked
  return {
    available: true,
    lastChecked: 0,
    errorCount: 0,
  };
}

/**
 * Check if Funnelcake API is available (circuit is closed)
 * Returns false if circuit is open (too many failures)
 */
export function isFunnelcakeAvailable(apiUrl: string): boolean {
  const status = getFunnelcakeStatus(apiUrl);

  // Circuit is open - check if enough time has passed for retry
  if (status.errorCount >= CIRCUIT_BREAKER_THRESHOLD) {
    const timeSinceLastCheck = Date.now() - status.lastChecked;
    if (timeSinceLastCheck < CIRCUIT_BREAKER_RESET_MS) {
      debugLog(`[FunnelcakeHealth] Circuit open for ${apiUrl}, waiting ${Math.round((CIRCUIT_BREAKER_RESET_MS - timeSinceLastCheck) / 1000)}s for retry`);
      return false;
    }
    // Enough time has passed, allow one retry
    debugLog(`[FunnelcakeHealth] Circuit half-open for ${apiUrl}, allowing retry`);
  }

  return status.available;
}

/**
 * Record a successful Funnelcake API call
 * Resets error count and closes circuit
 */
export function recordFunnelcakeSuccess(apiUrl: string): void {
  const status = getFunnelcakeStatus(apiUrl);

  if (status.errorCount > 0) {
    debugLog(`[FunnelcakeHealth] Funnelcake recovered for ${apiUrl}, resetting circuit`);
  }

  healthStatusByUrl.set(apiUrl, {
    available: true,
    lastChecked: Date.now(),
    errorCount: 0,
    lastError: undefined,
  });
}

/**
 * Record a failed Funnelcake API call
 * Increments error count and may open circuit
 */
export function recordFunnelcakeFailure(apiUrl: string, error: string): void {
  const status = getFunnelcakeStatus(apiUrl);
  const newErrorCount = status.errorCount + 1;

  const newStatus: FunnelcakeHealthStatus = {
    available: newErrorCount < CIRCUIT_BREAKER_THRESHOLD,
    lastChecked: Date.now(),
    errorCount: newErrorCount,
    lastError: error,
  };

  healthStatusByUrl.set(apiUrl, newStatus);

  if (newErrorCount >= CIRCUIT_BREAKER_THRESHOLD) {
    debugError(`[FunnelcakeHealth] Circuit opened for ${apiUrl} after ${newErrorCount} failures: ${error}`);
    addBreadcrumb('Funnelcake circuit breaker opened', 'api', { apiUrl, errorCount: newErrorCount, lastError: error });
    Sentry.captureMessage('Funnelcake circuit breaker opened', { level: 'warning', extra: { apiUrl, errorCount: newErrorCount, lastError: error } });
  } else {
    debugLog(`[FunnelcakeHealth] Funnelcake error ${newErrorCount}/${CIRCUIT_BREAKER_THRESHOLD} for ${apiUrl}: ${error}`);
    addBreadcrumb('Funnelcake API error', 'api', { apiUrl, errorCount: newErrorCount, error });
  }
}

/**
 * Reset circuit breaker state (useful for manual retry or testing)
 */
export function resetFunnelcakeCircuit(apiUrl: string): void {
  healthStatusByUrl.delete(apiUrl);
  debugLog(`[FunnelcakeHealth] Circuit reset for ${apiUrl}`);
}

/**
 * Reset all circuit breaker states
 */
export function resetAllFunnelcakeCircuits(): void {
  healthStatusByUrl.clear();
  debugLog(`[FunnelcakeHealth] All circuits reset`);
}

/**
 * Perform an active health check on Funnelcake API
 * @param apiUrl - Base URL of the Funnelcake API
 * @param timeout - Request timeout in milliseconds (default: 5000)
 * @returns Promise resolving to true if healthy, false otherwise
 */
export async function checkFunnelcakeHealth(
  apiUrl: string,
  timeout: number = 5000
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${apiUrl}/api/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      recordFunnelcakeSuccess(apiUrl);
      return true;
    }

    recordFunnelcakeFailure(apiUrl, `Health check returned ${response.status}`);
    return false;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    recordFunnelcakeFailure(apiUrl, `Health check failed: ${message}`);
    return false;
  }
}

/**
 * Determine if an error should trigger fallback to WebSocket
 * Some errors (like 4xx) indicate bad requests that won't succeed via WebSocket either
 */
export function shouldFallbackToWebSocket(statusCode: number | null, error: Error | null): boolean {
  // Network errors - always fallback
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes('timeout') ||
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('abort')) {
      return true;
    }
  }

  // HTTP status codes
  if (statusCode !== null) {
    // 5xx server errors - fallback
    if (statusCode >= 500) {
      return true;
    }

    // 4xx client errors - don't fallback (bad request won't work either way)
    if (statusCode >= 400 && statusCode < 500) {
      return false;
    }
  }

  // Default: don't fallback for unknown errors
  return false;
}
