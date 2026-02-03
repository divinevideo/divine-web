// ABOUTME: Syncs current Nostr login to Sentry user context for error tracking
// ABOUTME: Enables Sentry to count unique affected users per issue

import { useEffect } from 'react';
import { useNostrLogin } from '@nostrify/react/login';
import { setSentryUser } from '@/lib/sentry';

/**
 * Side-effect component that syncs the current user's pubkey to Sentry.
 * Must be rendered inside NostrLoginProvider.
 */
export function SentryUserSync() {
  const { logins } = useNostrLogin();
  const pubkey = logins[0]?.pubkey ?? null;

  useEffect(() => {
    setSentryUser(pubkey);
  }, [pubkey]);

  return null;
}
