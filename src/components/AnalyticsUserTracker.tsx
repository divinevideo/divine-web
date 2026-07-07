// ABOUTME: Component that tracks user identity for analytics
// ABOUTME: Updates Firebase Analytics user ID when user logs in/out

import { useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { setAnalyticsUserId, trackUserAction } from '@/lib/analytics';
import { configureProductAnalyticsIdentity, productAnalytics } from '@/lib/analyticsClient';

export function AnalyticsUserTracker() {
  const { user, signer } = useCurrentUser();

  useEffect(() => {
    if (user) {
      configureProductAnalyticsIdentity({ userPubkey: user.pubkey, signer });
      void productAnalytics.flush();

      // Set user ID for analytics
      setAnalyticsUserId(user.pubkey);

      // Track login event
      trackUserAction('login', {
        login_method: 'nostr',
      });
    } else {
      configureProductAnalyticsIdentity({});

      // Clear user ID when logged out
      setAnalyticsUserId(null);
    }
  }, [signer, user]);

  return null; // This component doesn't render anything
}
