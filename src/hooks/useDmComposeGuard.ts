// ABOUTME: Reusable compose-affordance guard enforcing Support-only messaging.
// ABOUTME: Retains protected-minor approved-recipient checks as defense in depth.

import { useEffect, useReducer } from 'react';
import { useProtectedMinorStatus } from '@/hooks/useProtectedMinorStatus';
import { isSupportDmRecipient } from '@/lib/dmAccessPolicy';
import { isDmComposeBlockedForMinor } from '@/lib/dmSendGuard';
import { officialAccountsService } from '@/lib/officialAccounts';
import { isMinorDmRestricted } from '@/lib/protectedMinor';

/**
 * Returns `isComposeBlocked(pubkey)`: whether the compose affordance to a given
 * account should be hidden for the current user. Every non-Support recipient is
 * blocked globally. Support still passes through the protected-minor policy:
 * protected and unknown users trigger receive-time official-account
 * revalidation, then use the synchronous verdict. A persisted verdict change
 * re-renders the consumer so the affordance updates.
 */
export function useDmComposeGuard(): {
  isComposeBlocked: (pubkey: string) => boolean;
} {
  const { state } = useProtectedMinorStatus();
  const [, bumpVerdicts] = useReducer((x: number) => x + 1, 0);
  useEffect(() => officialAccountsService.onVerdictChanged(bumpVerdicts), []);

  const isComposeBlocked = (pubkey: string): boolean => {
    if (!isSupportDmRecipient(pubkey)) {
      return true;
    }

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
