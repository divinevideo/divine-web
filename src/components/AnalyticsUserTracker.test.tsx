import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsUserTracker } from './AnalyticsUserTracker';

const { analyticsClient, currentUser } = vi.hoisted(() => ({
  analyticsClient: {
    configureIdentity: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
  },
  currentUser: {
    value: {
      user: undefined as { pubkey: string } | undefined,
      signer: undefined as object | undefined,
      isResolvingJwt: true,
    },
  },
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => currentUser.value,
}));

vi.mock('@/lib/analytics', () => ({
  setAnalyticsUserId: vi.fn(),
  trackUserAction: vi.fn(),
}));

vi.mock('@/lib/analyticsClient', () => ({
  configureProductAnalyticsIdentity: analyticsClient.configureIdentity,
  productAnalytics: { flush: analyticsClient.flush },
}));

describe('AnalyticsUserTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser.value = {
      user: undefined,
      signer: undefined,
      isResolvingJwt: true,
    };
  });

  it('preserves the stored identity while a hosted login resolves', () => {
    const { rerender } = render(<AnalyticsUserTracker />);

    expect(analyticsClient.configureIdentity).not.toHaveBeenCalled();

    const signer = {};
    currentUser.value = {
      user: { pubkey: 'b'.repeat(64) },
      signer,
      isResolvingJwt: false,
    };
    rerender(<AnalyticsUserTracker />);

    expect(analyticsClient.configureIdentity).toHaveBeenCalledOnce();
    expect(analyticsClient.configureIdentity).toHaveBeenCalledWith({
      userPubkey: 'b'.repeat(64),
      signer,
    });
  });
});
