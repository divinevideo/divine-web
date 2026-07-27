// ABOUTME: Send-side gate for the protected-minor DM restriction (#176 web). A
// ABOUTME: DM-restricted user (protected minor, or unknown status — fail closed)
// ABOUTME: may only DM approved official accounts; a group send is all-or-nothing.

import type { OfficialAccountsService } from './officialAccounts';
import { isMinorDmRestricted, type ProtectedMinorState } from './protectedMinor';

/** Thrown when a protected minor tries to DM a non-approved recipient. Typed so
 *  the UI can show distinct, non-retriable copy. */
export class DmSendBlockedError extends Error {
  constructor(public readonly recipientPubkey: string) {
    super('blocked: recipient not permitted for protected minor');
    this.name = 'DmSendBlockedError';
  }
}

/** Thrown when a send is blocked because the protected-minor status is
 *  `unknown` (fail closed). Typed so the UI can show retriable copy instead of
 *  the definitive official-accounts-only message. */
export class DmSendUnverifiedError extends Error {
  constructor(public readonly recipientPubkey: string) {
    super('blocked: protected-minor status unverified');
    this.name = 'DmSendUnverifiedError';
  }
}

/**
 * Rejects the send unless the sender's tri-state protected-minor `state` is a
 * positive `not_protected` OR every recipient is an approved official account
 * (group all-or-nothing — per-recipient gating alone would still deliver to the
 * approved participants). `unknown` restricts like `protected` but throws
 * {@link DmSendUnverifiedError} so the UI can frame it as retriable. Uses the
 * async recipient check so the verdict is fresh at send time.
 */
export async function assertMinorDmRecipientsAllowed(
  recipients: string[],
  opts: {
    state: ProtectedMinorState;
    service: Pick<OfficialAccountsService, 'isApprovedMinorDmRecipient'>;
  },
): Promise<void> {
  if (!isMinorDmRestricted(opts.state)) return;
  for (const recipient of recipients) {
    if (!(await opts.service.isApprovedMinorDmRecipient(recipient))) {
      throw opts.state === 'unknown'
        ? new DmSendUnverifiedError(recipient)
        : new DmSendBlockedError(recipient);
    }
  }
}

/**
 * Whether the compose affordance to [recipientPubkey] should be HIDDEN — a
 * DM-restricted user composing to a non-approved account. Sync (for rendering);
 * backed by the same approval the send gate enforces, so hiding it just avoids
 * a dead-end that the gate would block anyway. Never blocks a positively
 * not-protected user.
 */
export function isDmComposeBlockedForMinor(
  recipientPubkey: string,
  opts: {
    state: ProtectedMinorState;
    isApproved: (pubkey: string) => boolean;
  },
): boolean {
  return isMinorDmRestricted(opts.state) && !opts.isApproved(recipientPubkey);
}
