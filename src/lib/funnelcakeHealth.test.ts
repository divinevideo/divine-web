import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAddBreadcrumb = vi.fn();
const mockCaptureMessage = vi.fn();
const mockDebugError = vi.fn();

vi.mock('./debug', () => ({
  debugLog: vi.fn(),
  debugError: (...args: unknown[]) => mockDebugError(...args),
}));

vi.mock('./sentry', () => ({
  addBreadcrumb: (...args: unknown[]) => mockAddBreadcrumb(...args),
  Sentry: {
    captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
  },
}));

import {
  recordFunnelcakeFailure,
  recordFunnelcakeSuccess,
  resetAllFunnelcakeCircuits,
} from './funnelcakeHealth';

describe('funnelcakeHealth circuit breaker Sentry reporting', () => {
  const apiUrl = 'https://api.divine.video';

  beforeEach(() => {
    resetAllFunnelcakeCircuits();
    mockAddBreadcrumb.mockReset();
    mockCaptureMessage.mockReset();
    mockDebugError.mockReset();
  });

  it('reports circuit breaker open to Sentry only once per closed -> open transition', () => {
    recordFunnelcakeFailure(apiUrl, 'timeout 1');
    recordFunnelcakeFailure(apiUrl, 'timeout 2');
    expect(mockCaptureMessage).not.toHaveBeenCalled();

    // 3rd failure opens the circuit -> report once
    recordFunnelcakeFailure(apiUrl, 'timeout 3');
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);

    // Subsequent failures while already open must not spam Sentry
    recordFunnelcakeFailure(apiUrl, 'timeout 4');
    recordFunnelcakeFailure(apiUrl, 'timeout 5');
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    expect(mockDebugError).toHaveBeenCalledTimes(1);

    // After recovery, a fresh outage reports once again
    recordFunnelcakeSuccess(apiUrl);
    recordFunnelcakeFailure(apiUrl, 'new outage 1');
    recordFunnelcakeFailure(apiUrl, 'new outage 2');
    recordFunnelcakeFailure(apiUrl, 'new outage 3');
    expect(mockCaptureMessage).toHaveBeenCalledTimes(2);
  });
});
