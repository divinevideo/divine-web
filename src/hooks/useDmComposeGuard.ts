// ABOUTME: Reusable compose-affordance guard for the protected-minor DM
// ABOUTME: restriction (#176): hide "Message"/compose paths to non-approved
// ABOUTME: accounts. Defense-in-depth over the send gate + route guard.

import { useEffect, useReducer } from 'react';
import { useProtectedMinorStatus } from '@/hooks/useProtectedMinorStatus';
import { isDmComposeBlockedForMinor } from '@/lib/dmSendGuard';
import { officialAccountsService } from '@/lib/officialAccounts';
import { isMinorDmRestricted } from '@/lib/protectedMinor';

/**
 * Returns `isComposeBlocked(pubkey)`: whether the compose affordance to a given
 * account should be hidden for the current user. `false` for a positively
 * not-protected user. For a DM-restricted user (protected minor, or unknown
 * status — fail closed) it kicks a receive-time revalidation and returns the
 * sync verdict; a persisted flip re-renders the consumer (via
 * `onVerdictChanged`) so the affordance updates.
 */
export function useDmComposeGuard(): {
  isComposeBlocked: (pubkey: string) => boolean;
} {
  const { state } = useProtectedMinorStatus();
  const [, bumpVerdicts] = useReducer((x: number) => x + 1, 0);
  useEffect(() => officialAccountsService.onVerdictChanged(bumpVerdicts), []);

  const isComposeBlocked = (pubkey: string): boolean => {
    if (isMinorDmRestricted(state)) {
      void officialAccountsService.isApprovedMinorDmRecipient(pubkey);
    }
    return isDmComposeBlockedForMinor(pubkey, {
      state,
      isApproved: (candidate) =>
        officialAccountsService.isApprovedMinorDmRecipientSync(candidate),
    });
  };

  return { isComposeBlocked };
}
