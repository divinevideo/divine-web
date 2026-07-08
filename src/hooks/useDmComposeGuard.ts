// ABOUTME: Reusable compose-affordance guard for the protected-minor DM
// ABOUTME: restriction (#176): hide "Message"/compose paths to non-approved
// ABOUTME: accounts. Defense-in-depth over the send gate + route guard.

import { useEffect, useReducer } from 'react';
import { useIsProtectedMinor } from '@/hooks/useProtectedMinorStatus';
import { isDmComposeBlockedForMinor } from '@/lib/dmSendGuard';
import { officialAccountsService } from '@/lib/officialAccounts';

/**
 * Returns `isComposeBlocked(pubkey)`: whether the compose affordance to a given
 * account should be hidden for the current user. `false` for a non-restricted
 * user. For a protected minor it kicks a receive-time revalidation and returns
 * the sync verdict; a persisted flip re-renders the consumer (via
 * `onVerdictChanged`) so the affordance updates.
 */
export function useDmComposeGuard(): {
  isProtectedMinor: boolean;
  isComposeBlocked: (pubkey: string) => boolean;
} {
  const isProtectedMinor = useIsProtectedMinor();
  const [, bumpVerdicts] = useReducer((x: number) => x + 1, 0);
  useEffect(() => officialAccountsService.onVerdictChanged(bumpVerdicts), []);

  const isComposeBlocked = (pubkey: string): boolean => {
    if (isProtectedMinor) {
      void officialAccountsService.isApprovedMinorDmRecipient(pubkey);
    }
    return isDmComposeBlockedForMinor(pubkey, {
      isProtectedMinor,
      isApproved: (candidate) =>
        officialAccountsService.isApprovedMinorDmRecipientSync(candidate),
    });
  };

  return { isProtectedMinor, isComposeBlocked };
}
