// ABOUTME: Send-side gate for the protected-minor DM restriction (#176 web). A
// ABOUTME: protected minor may only DM approved official accounts; a group send
// ABOUTME: is all-or-nothing. Pure + injectable so useDmSend stays thin.

import { OfficialAccountsService } from './officialAccounts';

/** Thrown when a protected minor tries to DM a non-approved recipient. Typed so
 *  the UI can show distinct, non-retriable copy. */
export class DmSendBlockedError extends Error {
  constructor(public readonly recipientPubkey: string) {
    super('blocked: recipient not permitted for protected minor');
    this.name = 'DmSendBlockedError';
  }
}

/**
 * Rejects the send if the current user is a protected minor and ANY recipient
 * is not an approved official account (group all-or-nothing — per-recipient
 * gating alone would still deliver to the approved participants). No-op for a
 * non-restricted user. Uses the async recipient check so the verdict is fresh
 * at send time.
 */
export async function assertMinorDmRecipientsAllowed(
  recipients: string[],
  opts: {
    isProtectedMinor: boolean;
    service: Pick<OfficialAccountsService, 'isApprovedMinorDmRecipient'>;
  },
): Promise<void> {
  if (!opts.isProtectedMinor) return;
  for (const recipient of recipients) {
    if (!(await opts.service.isApprovedMinorDmRecipient(recipient))) {
      throw new DmSendBlockedError(recipient);
    }
  }
}

/**
 * Whether the compose affordance to [recipientPubkey] should be HIDDEN — a
 * protected minor composing to a non-approved account. Sync (for rendering);
 * backed by the same approval the send gate enforces, so hiding it just avoids
 * a dead-end that the gate would block anyway. Never blocks a non-restricted
 * user.
 */
export function isDmComposeBlockedForMinor(
  recipientPubkey: string,
  opts: { isProtectedMinor: boolean; isApproved: (pubkey: string) => boolean },
): boolean {
  return opts.isProtectedMinor && !opts.isApproved(recipientPubkey);
}
